// lib/nsApi.ts
import { parseStringPromise } from 'xml2js'; // Still useful for parsing structured XML if needed, but not for nation chunks now
import { db, NationCacheRow } from './db';
import { throttledNsFetch, FetchError } from './nsRateLimiter';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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
    console.log('Starting daily nations dump processing (streaming object-building approach)...');
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
        await pipeline(response.body as any, fileWriteStream);
        console.log('Dump downloaded successfully.');

        // 2. Set up streaming XML parser to build objects directly
        const gunzip = zlib.createGunzip();
        const xmlReadStream = fs.createReadStream(tempFilePath);

        const saxStream = sax.createStream(true, { // `true` for strict parsing
            trim: true,
            normalize: true,
            lowercase: false, // NationStates XML uses uppercase tags
            position: true
        });

        let currentNation: { NAME?: string; FLAG?: string; REGION?: string } = {};
        let currentTag: string | null = null; // To keep track of the tag whose text content we're currently collecting

        // Promise to track the completion of XML parsing and batch insertions
        const nationParsingPromise = new Promise<void>((resolve, reject) => {
            saxStream.on('error', (e: any) => {
                console.error('SAX Parser Error:', e);
                reject(e);
            });

            saxStream.on('opentag', (node: sax.Tag) => {
                if (node.name === 'NATION') {
                    currentNation = {}; // Start a new nation object
                }
                currentTag = node.name; // Keep track of the currently open tag
            });

            saxStream.on('text', (text: string) => {
                if (currentTag && currentNation) {
                    // Only collect text for specific top-level tags we care about
                    if (['NAME', 'FLAG', 'REGION'].includes(currentTag)) {
                        // Append text content. SAX provides unescaped text.
                        (currentNation as any)[currentTag] = (currentNation as any)[currentTag] ? (currentNation as any)[currentTag] + text : text;
                    }
                }
            });

            saxStream.on('closetag', async (tagName: string) => {
                currentTag = null; // Clear current tag context

                if (tagName === 'NATION') {
                    // NATION tag closed, process the collected nation data
                    if (currentNation.NAME) { // Ensure it's a valid nation
                        const nationName = currentNation.NAME;
                        const flagCode = currentNation.FLAG;
                        const flagUrl = flagCode ? `https://www.nationstates.net/images/flags/${flagCode}.jpg` : '';
                        const region = currentNation.REGION || 'Unknown Region';

                        batch.push({ nationName, flagUrl, region });

                        if (batch.length >= BATCH_SIZE) {
                            await insertNationBatch(batch);
                            nationsProcessed += batch.length;
                            batch = []; // Clear batch after insertion
                        }
                    }
                    currentNation = {}; // Reset for the next nation
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

    // Use parameterized query with UNNEST for efficient batch insert/update in PostgreSQL
    // This is much safer against SQL injection and correctly handles escaping.
    const nationNames = batch.map(n => n.nationName);
    const flagUrls = batch.map(n => n.flagUrl);
    const regions = batch.map(n => n.region);

    const sql = `
    INSERT INTO nation_cache ("nationName", "flagUrl", region, "lastUpdated")
    SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], NOW()::timestamptz[])
    ON CONFLICT ("nationName") DO UPDATE SET
      "flagUrl" = EXCLUDED."flagUrl",
      region = EXCLUDED.region,
      "lastUpdated" = NOW();
  `;

    // console.log(`Inserting/Updating batch of ${batch.length} nations...`); // Too noisy for large dumps
    await db.run(sql, [nationNames, flagUrls, regions]);
}