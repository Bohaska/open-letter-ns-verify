// lib/nsApi.ts
import { parseStringPromise } from 'xml2js';
import { db, NationCacheRow } from './db';
import { throttledNsFetch, FetchError } from './nsRateLimiter'; // Still needed for verifyNation
import crypto from 'crypto';

const NS_API_BASE_URL = 'https://www.nationstates.net/cgi-bin/api.cgi';
const NS_DUMP_NATIONS_URL = 'https://www.nationstates.net/pages/nations.xml.gz'; // New: Daily dump URL
const USER_AGENT = 'OpenLetterNSVerify/1.0 (contact@example.com - replace with your actual contact)';

const CACHE_DURATION_HOURS = 24; // Still relevant for determining when to refresh the cache via dump

function generateNSTokenServer(nationName: string): string {
    if (!process.env.NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET) {
        throw new Error('NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET is not set for server-side token generation.');
    }
    return crypto
        .createHmac('sha256', process.env.NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET)
        .update(nationName.toLowerCase())
        .digest('hex');
}

/**
 * Verifies a NationStates nation using the provided checksum.
 * This function still hits the live API for single-nation verification,
 * as it's not bulk data and needs to be real-time.
 * @param nationName The name of the nation to verify.
 * @param checksum The checksum code provided by the user from NationStates.
 * @returns true if verification is successful, false otherwise.
 */
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

/**
 * Fetches basic display data (flag, region) for a given nation from the NationStates cache.
 * It NO LONGER hits the live API. Data is expected to be pre-populated by a daily dump process.
 * @param nationName The name of the nation.
 * @returns An object with nation name, flag URL, and region, or null if not found in cache.
 */
export async function getNationDisplayData(nationName: string): Promise<NationDisplayData | null> {
    try {
        const cachedData: NationCacheRow | undefined = await db.get(
            'SELECT "flagUrl", region FROM nation_cache WHERE "nationName" = $1', // Removed lastUpdated from select as freshness is managed by dump process
            [nationName]
        );

        if (cachedData) {
            // Data is retrieved directly from cache, no freshness check here as the dump updates it.
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

// New function to process daily dump
import * as zlib from 'zlib'; // Node.js built-in for gzip
import { pipeline } from 'stream/promises'; // For stream processing
import { createWriteStream } from 'fs'; // Node.js built-in for file system
import path from 'path'; // Node.js built-in for path manipulation
import os from 'os'; // Node.js built-in for temp directory

/**
 * Downloads the daily nations dump, processes it, and updates the nation_cache table.
 * This should be triggered as a scheduled task (e.g., via a cron job).
 */
export async function processDailyNationDump(): Promise<{ success: boolean; message: string; nationsProcessed?: number }> {
    console.log('Starting daily nations dump processing...');
    const tempFilePath = path.join(os.tmpdir(), `nations_dump_${Date.now()}.xml.gz`);
    let nationsProcessed = 0;

    try {
        // 1. Download the gzipped dump file
        console.log(`Downloading dump from ${NS_DUMP_NATIONS_URL} to ${tempFilePath}`);
        const response = await fetch(NS_DUMP_NATIONS_URL, {
            headers: { 'User-Agent': USER_AGENT }
        });

        if (!response.ok || !response.body) {
            throw new Error(`Failed to download daily dump: ${response.status} - ${response.statusText}`);
        }

        const fileStream = createWriteStream(tempFilePath);
        await pipeline(response.body as any, fileStream); // Use as any due to Response.body not being a standard readable stream type in TS
        console.log('Dump downloaded successfully.');

        // 2. Decompress and read the XML
        const gunzip = zlib.createGunzip();
        const xmlStream = require('fs').createReadStream(tempFilePath).pipe(gunzip);

        let xmlData = '';
        xmlStream.on('data', (chunk: Buffer) => {
            xmlData += chunk.toString();
        });

        await new Promise<void>((resolve, reject) => {
            xmlStream.on('end', resolve);
            xmlStream.on('error', reject);
        });
        console.log('Dump decompressed successfully.');

        // 3. Parse XML and update database in batches
        console.log('Parsing XML and preparing for database update...');
        const result = await parseStringPromise(xmlData, { explicitArray: false, mergeAttrs: true });
        const nations = result.NATIONS.NATION; // Expect an array of NATION objects

        if (!Array.isArray(nations)) {
            console.warn('Expected nations to be an array but got:', nations);
            throw new Error('Unexpected dump format: NATIONS.NATION is not an array.');
        }

        // Prepare for batch insertion/update
        const BATCH_SIZE = 500; // Adjust based on your database performance and Vercel limits
        const updatePromises: Promise<void>[] = [];

        for (let i = 0; i < nations.length; i += BATCH_SIZE) {
            const batch = nations.slice(i, i + BATCH_SIZE);
            const values = batch.map((nation: any) => {
                const nationName = nation.NAME;
                const flagCode = nation.FLAG;
                const flagUrl = flagCode ? `https://www.nationstates.net/images/flags/${flagCode}.jpg` : '';
                const region = nation.REGION || 'Unknown Region'; // Fallback for region
                return `('${nationName.replace(/'/g, "''")}', '${flagUrl.replace(/'/g, "''")}', '${region.replace(/'/g, "''")}')`;
            }).join(',');

            if (values) {
                const sql = `
              INSERT INTO nation_cache ("nationName", "flagUrl", region, "lastUpdated")
              VALUES ${values}
              ON CONFLICT ("nationName") DO UPDATE SET "flagUrl" = EXCLUDED."flagUrl", region = EXCLUDED.region, "lastUpdated" = NOW();
          `;
                updatePromises.push(db.run(sql));
                nationsProcessed += batch.length;
            }
        }

        await Promise.all(updatePromises);
        console.log(`Database update complete. Processed ${nationsProcessed} nations.`);

        // 4. Clean up temporary file
        require('fs').unlink(tempFilePath, (err: any) => {
            if (err) console.error(`Error deleting temp file ${tempFilePath}:`, err);
            else console.log(`Cleaned up temp file: ${tempFilePath}`);
        });

        return { success: true, message: `Successfully processed ${nationsProcessed} nations from daily dump.`, nationsProcessed };

    } catch (error: any) {
        console.error('Error processing daily nation dump:', error);
        // Clean up temp file even on error
        require('fs').unlink(tempFilePath, (err: any) => {
            if (err) console.error(`Error deleting temp file ${tempFilePath} after error:`, err);
        });
        return { success: false, message: `Failed to process daily dump: ${error?.message || String(error)}` };
    }
}

// Add polyfills for Node.js modules that are not automatically bundled by Next.js if needed by processDailyNationDump.
// Vercel's Node.js runtime generally has these, but explicit import ensures bundling for serverless functions.
// Note: 'stream/promises' and 'zlib' are standard Node.js modules. 'fs' is also.
// The require('fs') part is a common way to use 'fs' when you don't want it to be a top-level import to avoid client-side bundling issues.
// But since this entire file is server-side only, an `import * as fs from 'fs'` would also be fine.