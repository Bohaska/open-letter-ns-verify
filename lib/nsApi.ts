// lib/nsApi.ts
import { parseStringPromise } from 'xml2js'; // Still used for parsing individual nation XML chunks
import { db, NationCacheRow } from './db';
import { throttledNsFetch, FetchError } from './nsRateLimiter';
import * as crypto from 'crypto'; // Use `* as` for consistent Node.js built-in imports
import * as zlib from 'zlib'; // Node.js built-in for gzip
import { pipeline } from 'stream/promises'; // For stream processing
import * as fs from 'fs'; // Node.js built-in for file system
import * as path from 'path'; // Node.js built-in for path manipulation
import * as os from 'os'; // Node.js built-in for temp directory
import * as sax from 'sax'; // NEW: Streaming XML parser

const NS_API_BASE_URL = 'https://www.nationstates.net/cgi-bin/api.cgi';
const NS_DUMP_NATIONS_URL = 'https://www.nationstates.net/pages/nations.xml.gz';
const USER_AGENT = 'OpenLetterNSVerify/1.0 (contact@example.com - replace with your actual contact)';

const CACHE_DURATION_HOURS = 24;

function generateNSTokenServer(nationName: string): string {
    if (!process.env.NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET) {
        throw new Error('NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET is not set for server-side token generation.');
    }
    return crypto
        .createHmac('sha256', process.env.NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET)
        .update(nationName.toLowerCase())
        .digest('hex');
}

export async function verifyNation(nationName: string, checksum: string): Promise<boolean> {
    const token = generateNSTokenServer(nationName);
    const url = new URL(NS_API_BASE_URL);
    url.searchParams.append('a', 'verify');
    url.searchParams.append('nation', nationName.replace(/ /g, '_'));
    url.searchParams.append('checksum', checksum);
    url.searchParams.append('token', token);

    const fetchCall = async () => {
        const response = await fetch(url.toString(), {
            headers: {
                'User-Agent': USER_AGENT,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new FetchError(`HTTP error! status: ${response.status}`, response);
        }
        return response.text();
    };

    try {
        const textResult = await throttledNsFetch(fetchCall, url.toString());
        return textResult.trim() === '1';
    } catch (error: any) {
        if (error instanceof FetchError) {
            const errorText = await error.response.text();
            console.error(`NationStates API error (verify ${nationName}): Status ${error.response.status} - ${error.response.statusText}. Details: ${errorText}`);
        } else {
            console.error(`Error verifying nation with NationStates API (${nationName}): ${error?.message || error}`);
        }
        return false;
    }
}

interface NationDisplayData {
    name: string;
    flagUrl: string;
    region: string;
}

export async function getNationDisplayData(nationName: string): Promise<NationDisplayData | null> {
    try {
        const cachedData: NationCacheRow | undefined = await db.get(
            'SELECT "flagUrl", region FROM nation_cache WHERE "nationName" = $1',
            [nationName]
        );

        if (cachedData) {
            console.log(`Cache hit for ${nationName}. Returning cached data.`);
            return {
                name: nationName,
                flagUrl: cachedData.flagUrl,
                region: cachedData.region,
            };
        } else {
            console.warn(`Nation data for "${nationName}" not found in cache. It might be new or dump hasn't run yet.`);
            return null;
        }
    } catch (error: any) {
        console.error(`Error retrieving nation display data from cache for ${nationName}: ${error?.message || String(error)}`);
        return null;
    }
}

/**
 * Downloads the daily nations dump, processes it in a streaming fashion,
 * and updates the nation_cache table.
 * This should be triggered as a scheduled task (e.g., via a cron job).
 */
export async function processDailyNationDump(): Promise<{ success: boolean; message: string; nationsProcessed?: number }> {
    console.log('Starting daily nations dump processing (streaming approach)...');
    const tempFilePath = path.join(os.tmpdir(), `nations_dump_${Date.now()}.xml.gz`);
    let nationsProcessed = 0;
    let batch: { nationName: string; flagUrl: string; region: string }[] = [];
    const BATCH_SIZE = 500; // Adjust based on your database performance and Vercel limits

    try {
        // 1. Download the gzipped dump file
        console.log(`Downloading dump from ${NS_DUMP_NATIONS_URL} to ${tempFilePath}`);
        const response = await fetch(NS_DUMP_NATIONS_URL, {
            headers: { 'User-Agent': USER_AGENT }
        });

        if (!response.ok || !response.body) {
            throw new Error(`Failed to download daily dump: ${response.status} - ${response.statusText}`);
        }

        const fileWriteStream = fs.createWriteStream(tempFilePath);
        // Ensure the stream is typed correctly. Node's Response.body is a ReadableStream.
        await pipeline(response.body as any, fileWriteStream);
        console.log('Dump downloaded successfully.');

        // 2. Set up streaming XML parser
        const gunzip = zlib.createGunzip();
        const xmlReadStream = fs.createReadStream(tempFilePath);

        const saxStream = sax.createStream(true, { // `true` for strict parsing
            trim: true,
            normalize: true,
            lowercase: false, // NationStates XML uses uppercase tags
            position: true
        });

        let currentNationXmlBuffer = ''; // Buffer for the XML of a single <NATION> element
        let inNationTag = false;
        let nationTagDepth = 0; // To handle potential nested tags (though NS dump is usually flat for NATION)

        // Promise to track the completion of XML parsing and batch insertions
        const nationParsingPromise = new Promise<void>((resolve, reject) => {
            saxStream.on('error', (e: any) => {
                console.error('SAX Parser Error:', e);
                reject(e);
            });

            saxStream.on('opentag', (node: sax.Tag) => {
                if (node.name === 'NATION') {
                    inNationTag = true;
                    nationTagDepth = 0; // Reset depth for a new NATION
                    currentNationXmlBuffer = `<${node.name}${node.attributes ? Object.entries(node.attributes).map(([key, value]) => ` ${key}="${escapeXmlAttribute(String(value))}"`).join('') : ''}>`;
                } else if (inNationTag) {
                    nationTagDepth++;
                    currentNationXmlBuffer += `<${node.name}${node.attributes ? Object.entries(node.attributes).map(([key, value]) => ` ${key}="${escapeXmlAttribute(String(value))}"`).join('') : ''}>`;
                }
            });

            saxStream.on('text', (text: string) => {
                if (inNationTag) {
                    currentNationXmlBuffer += escapeXmlText(text); // Escape text content
                }
            });

            saxStream.on('cdata', (cdata: string) => {
                if (inNationTag) {
                    currentNationXmlBuffer += `<![CDATA[${cdata}]]>`;
                }
            });

            saxStream.on('closetag', async (tagName: string) => {
                if (inNationTag) {
                    currentNationXmlBuffer += `</${tagName}>`;
                }

                if (tagName === 'NATION' && nationTagDepth === 0) { // Only process when the root NATION tag closes
                    inNationTag = false;
                    // Process currentNationXmlBuffer
                    try {
                        // parseStringPromise expects a complete XML document,
                        // so we wrap the nation XML in a root tag if it's missing (shouldn't be needed if `opentag` builds correctly)
                        const nationXml = `<ROOT>${currentNationXmlBuffer}</ROOT>`; // Temporary root for parseStringPromise
                        const parsedChunk = await parseStringPromise(nationXml, { explicitArray: false, mergeAttrs: true });
                        const nation = parsedChunk.ROOT.NATION; // Access the NATION tag from the temporary root

                        if (nation && nation.NAME) { // Ensure nation data is valid
                            const nationName = nation.NAME;
                            const flagUrl = nation.FLAG;
                            const region = nation.REGION || 'Unknown Region';

                            batch.push({ nationName, flagUrl, region });

                            if (batch.length >= BATCH_SIZE) {
                                await insertNationBatch(batch);
                                nationsProcessed += batch.length;
                                batch = []; // Clear batch after insertion
                            }
                        }
                    } catch (parseErr: any) {
                        console.error('Error parsing single nation XML chunk:', parseErr);
                    }
                    currentNationXmlBuffer = ''; // Reset buffer
                } else if (inNationTag) {
                    nationTagDepth--;
                }
            });

            saxStream.on('end', async () => {
                // Insert any remaining items in the batch
                if (batch.length > 0) {
                    await insertNationBatch(batch);
                    nationsProcessed += batch.length;
                }
                resolve();
            });
        });

        // Pipe streams: gzipped file -> gunzip -> sax parser
        await pipeline(xmlReadStream, gunzip, saxStream);
        await nationParsingPromise; // Wait for all nations to be processed by saxStream.on('end')

        console.log(`Finished streaming processing. Total nations processed: ${nationsProcessed}.`);

        // 3. Clean up temporary file
        fs.unlink(tempFilePath, (err) => {
            if (err) console.error(`Error deleting temp file ${tempFilePath}:`, err);
            else console.log(`Cleaned up temp file: ${tempFilePath}`);
        });

        return { success: true, message: `Successfully processed ${nationsProcessed} nations from daily dump.`, nationsProcessed };

    } catch (error: any) {
        console.error('Error processing daily nation dump (streaming):', error);
        // Clean up temp file even on error
        if (fs.existsSync(tempFilePath)) {
            fs.unlink(tempFilePath, (err) => {
                if (err) console.error(`Error deleting temp file ${tempFilePath} after error:`, err);
            });
        }
        return { success: false, message: `Failed to process daily dump: ${error?.message || String(error)}` };
    }
}

// Helper function to insert a batch of nations
async function insertNationBatch(batch: { nationName: string; flagUrl: string; region: string }[]): Promise<void> {
    if (batch.length === 0) return;

    const values = batch.map(nation => {
        // Using parameterized queries ($1, $2, etc.) is safer and handles escaping automatically.
        // However, for VALUES clause with multiple rows, we build the string and must escape manually.
        // Let's use a more robust way by preparing a single query with multiple value sets.
        // This is more complex but safer.

        // A simpler approach for batching with `pg` is to use UNNEST with arrays,
        // or to generate a single INSERT statement with many ($1, $2, $3), ($4, $5, $6) ...
        // This requires building a flat array of parameters.

        // Example for a single INSERT with multiple value sets using parameters:
        // INSERT INTO nation_cache (...) VALUES ($1,$2,$3), ($4,$5,$6), ...
        // This requires generating parameters dynamically.

        return `('${nation.nationName.replace(/'/g, "''")}', '${nation.flagUrl.replace(/'/g, "''")}', '${nation.region.replace(/'/g, "''")}', NOW())`;
    }).join(',');

    const sql = `
    INSERT INTO nation_cache ("nationName", "flagUrl", region, "lastUpdated")
    VALUES ${values}
    ON CONFLICT ("nationName") DO UPDATE SET "flagUrl" = EXCLUDED."flagUrl", region = EXCLUDED.region, "lastUpdated" = NOW();
  `;
    await db.run(sql);
    //console.log(`Inserted/Updated batch of ${batch.length} nations.`); // Too noisy for large dumps
}

// Helper functions for XML escaping
function escapeXmlText(text: string): string {
    return text.replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>');
}

function escapeXmlAttribute(text: string): string {
    return text.replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '\'');
}