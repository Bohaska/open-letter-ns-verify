// lib/nsApi.ts

import crypto from 'crypto';
import { parseStringPromise } from 'xml2js';
// Removed 'crypto' import as generateNSToken is moved
import { db, NationCacheRow } from './db'; // db and NationCacheRow are server-side only

const NS_API_BASE_URL = 'https://www.nationstates.net/cgi-bin/api.cgi';
const USER_AGENT = 'OpenLetterNSVerify/1.0 (contact@example.com - replace with your actual contact)';

// Removed generateNSToken export from here. It's now in lib/client/ns-token-generator.ts.

// Define cache duration in hours
const CACHE_DURATION_HOURS = 24;

/**
 * Verifies a NationStates nation using the provided checksum.
 * This endpoint returns a plain '1' or '0', not XML.
 * This function is intended for server-side execution.
 * @param nationName The name of the nation to verify.
 * @param checksum The checksum code provided by the user from NationStates.
 * @returns true if verification is successful, false otherwise.
 */
export async function verifyNation(nationName: string, checksum: string): Promise<boolean> {
    // This function would typically receive the token or generate it using a server-side method if needed
    // For now, it relies on the client passing the correct token, which it gets from the client-side generator.
    // We don't need generateNSToken here, as the API route will call it.
    const url = new URL(NS_API_BASE_URL);
    url.searchParams.append('a', 'verify');
    url.searchParams.append('nation', nationName.replace(/ /g, '_'));
    url.searchParams.append('checksum', checksum);
    // Important: If you needed the token here for server-side verification directly from NationStates,
    // you would also import a server-side version of generateNSToken or pass it in.
    // For now, as the token is for `page=verify_login?token=`, the client handles it.
    const token = generateNSTokenServer(nationName); // Call a server-side only token generator if verifyNation required it
    url.searchParams.append('token', token);


    try {
        const response = await fetch(url.toString(), {
            headers: {
                'User-Agent': USER_AGENT,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`NationStates API error (verify ${nationName}): Status ${response.status} - ${response.statusText}. Details: ${errorText}`);
            return false;
        }

        const textResult = await response.text();
        return textResult.trim() === '1';

    } catch (error: any) {
        console.error(`Error verifying nation with NationStates API (${nationName}): ${error?.message || error}`);
        return false;
    }
}

// Re-add a server-side only generateNSToken for use within lib/nsApi.ts if needed by other server-side functions
// (e.g., if you later want verifyNation to re-generate the token for its own call to NS API).
// For the current setup, verifyNation relies on the client to send the correct token, so this is illustrative.
function generateNSTokenServer(nationName: string): string {
    if (!process.env.NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET) {
        throw new Error('NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET is not set for server-side use.');
    }
    return crypto
        .createHmac('sha256', process.env.NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET)
        .update(nationName.toLowerCase())
        .digest('hex');
}


interface NationDisplayData {
    name: string;
    flagUrl: string;
    region: string;
}

/**
 * Fetches basic display data (flag, region) for a given nation from the NationStates API.
 * Implements a caching mechanism. This function is intended for server-side execution.
 * Returns null if data cannot be fetched, if the nation is invalid, or if parsing fails.
 * @param nationName The name of the nation.
 * @returns An object with nation name, flag URL, and region, or null.
 */
export async function getNationDisplayData(nationName: string): Promise<NationDisplayData | null> {
    const formattedNationName = nationName.replace(/ /g, '_');
    const now = new Date();

    try {
        // 1. Check Cache First
        const cachedData: NationCacheRow | undefined = await db.get(
            'SELECT "flagUrl", region, "lastUpdated" FROM nation_cache WHERE "nationName" = $1',
            [nationName]
        );

        if (cachedData) {
            const lastUpdatedDate = new Date(cachedData.lastUpdated);
            const hoursSinceUpdate = (now.getTime() - lastUpdatedDate.getTime()) / (1000 * 60 * 60);

            if (hoursSinceUpdate < CACHE_DURATION_HOURS) {
                console.log(`Cache hit for ${nationName}. Returning cached data.`);
                return {
                    name: nationName,
                    flagUrl: cachedData.flagUrl,
                    region: cachedData.region,
                };
            } else {
                console.log(`Cache expired for ${nationName}. Fetching from API.`);
            }
        } else {
            console.log(`No cache entry for ${nationName}. Fetching from API.`);
        }

        // 2. If not in cache or cache expired, fetch from NationStates API
        const url = new URL(NS_API_BASE_URL);
        url.searchParams.append('nation', formattedNationName);
        url.searchParams.append('q', 'flag+region');

        const response = await fetch(url.toString(), {
            headers: {
                'User-Agent': USER_AGENT,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`NationStates API error (getNationDisplayData for ${nationName}): Status ${response.status} - ${response.statusText}. Details: ${errorText}`);
            return null;
        }

        const xml = await response.text();
        if (!xml.trim().startsWith('<')) {
            console.warn(`Non-XML response for nation ${nationName}. Returning null. Response snippet: ${xml.substring(0, 100)}...`);
            return null;
        }

        const result = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });
        const nationData = result.NATION;

        const isValidNationData = nationData && nationData.NAME;

        if (!isValidNationData) {
            console.warn(`No valid nation data (missing <NAME> tag) or invalid nation response for: ${nationName}. Full XML:`, xml);
            if (cachedData) {
                await db.run('DELETE FROM nation_cache WHERE "nationName" = $1', [nationName]);
                console.log(`Removed invalid cached entry for ${nationName}.`);
            }
            return null;
        }

        const flagCode = nationData.FLAG;
        const fetchedFlagUrl = flagCode ? `https://www.nationstates.net/images/flags/${flagCode}.jpg` : '';
        const fetchedRegion = nationData.REGION;

        // 3. Update/Insert into Cache
        await db.run(
            `INSERT INTO nation_cache ("nationName", "flagUrl", region, "lastUpdated")
             VALUES ($1, $2, $3, NOW())
                 ON CONFLICT ("nationName") DO UPDATE SET "flagUrl" = $2, region = $3, "lastUpdated" = NOW()`,
            [nationData.NAME, fetchedFlagUrl, fetchedRegion]
        );
        console.log(`Cache updated/inserted for ${nationData.NAME}.`);

        return {
            name: nationData.NAME,
            flagUrl: fetchedFlagUrl,
            region: fetchedRegion || 'Unknown Region',
        };
    } catch (error: any) {
        console.error(`Error fetching or caching nation display data for ${nationName}: ${error?.message || String(error)}`);
        return null;
    }
}