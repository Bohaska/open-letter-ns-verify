// lib/nsApi.ts
import { parseStringPromise } from 'xml2js';
import crypto from 'crypto';

const NS_API_BASE_URL = 'https://www.nationstates.net/cgi-bin/api.cgi';
const USER_AGENT = 'OpenLetterNSVerify/1.0 (Jiangbei)'; // IMPORTANT: Set a meaningful User-Agent

/**
 * Generates a consistent token for NationStates verification based on the nation name.
 * This token is used to ensure the checksum is site-specific.
 * @param nationName The name of the nation.
 * @returns A SHA256 hash as the token.
 */
export function generateNSToken(nationName: string): string {
    if (!process.env.NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET) {
        throw new Error('NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET is not set in environment variables.');
    }
    return crypto
        .createHmac('sha256', process.env.NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET)
        .update(nationName.toLowerCase())
        .digest('hex');
}

/**
 * Verifies a NationStates nation using the provided checksum.
 * This endpoint returns a plain '1' or '0', not XML.
 * @param nationName The name of the nation to verify.
 * @param checksum The checksum code provided by the user from NationStates.
 * @returns true if verification is successful, false otherwise.
 */
export async function verifyNation(nationName: string, checksum: string): Promise<boolean> {
    const token = generateNSToken(nationName);
    const url = new URL(NS_API_BASE_URL);
    url.searchParams.append('a', 'verify');
    url.searchParams.append('nation', nationName.replace(/ /g, '_')); // Replace spaces for URL
    url.searchParams.append('checksum', checksum);
    url.searchParams.append('token', token);

    try {
        const response = await fetch(url.toString(), {
            headers: {
                'User-Agent': USER_AGENT,
            },
            cache: 'no-store', // Important: Ensures fresh data for verification
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`NationStates API error (verify ${nationName}): Status ${response.status} - ${response.statusText}. Details: ${errorText}`);
            return false;
        }

        const textResult = await response.text();
        // The verify endpoint returns plain '1' or '0'
        return textResult.trim() === '1'; // Trim to remove any potential whitespace

    } catch (error: any) { // Explicitly type error as any for logging flexibility
        console.error(`Error verifying nation with NationStates API (${nationName}): ${error?.message || error}`);
        return false;
    }
}

interface NationDisplayData {
    name: string;
    flagUrl: string;
    region: string;
}

/**
 * Fetches basic display data (flag, region) for a given nation from the NationStates API.
 * Returns null if data cannot be fetched, if the nation is invalid, or if parsing fails.
 * @param nationName The name of the nation.
 * @returns An object with nation name, flag URL, and region, or null.
 */
export async function getNationDisplayData(nationName: string): Promise<NationDisplayData | null> {
    const url = new URL(NS_API_BASE_URL);
    url.searchParams.append('nation', nationName.replace(/ /g, '_'));
    url.searchParams.append('q', 'flag+region'); // Request flag and region shards

    try {
        const response = await fetch(url.toString(), {
            headers: {
                'User-Agent': USER_AGENT,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`NationStates API error (getNationDisplayData for ${nationName}): Status ${response.status} - ${response.statusText}. Details: ${errorText}`);
            return null; // Return null on non-OK HTTP status
        }

        const xml = await response.text();
        console.log(xml);

        // Basic sanity check for XML structure to avoid parsing non-XML errors
        if (!xml.trim().startsWith('<')) {
            console.warn(`Non-XML response for nation ${nationName}. Returning null. Response snippet: ${xml.substring(0, 100)}...`);
            return null;
        }

        const result = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });

        const nationData = result.NATION;

        // Crucial: Check if the NATION tag exists AND if it contains a NAME tag.
        // The NS API returns <NATION id="invalid_name"/> for non-existent nations,
        // which won't have a <NAME> sub-tag.
        const isValidNationData = nationData && nationData.NAME;

        if (!isValidNationData) {
            console.warn(`No valid nation data (missing <NAME> tag) or invalid nation response for: ${nationName}. Full XML:`, xml);
            return null;
        }

        const flagCode = nationData.FLAG;
        const flagUrl = flagCode ? `https://www.nationstates.net/images/flags/${flagCode}.jpg` : '';
        const region = nationData.REGION;

        return {
            name: nationData.NAME, // We are now confident nationData.NAME exists
            flagUrl: flagUrl,
            region: region || 'Unknown Region', // Fallback for region if it's missing (shouldn't be if NAME exists, but good to be safe)
        };
    } catch (error: any) { // Explicitly type error as any for logging flexibility
        console.error(`Error fetching nation display data for ${nationName}: ${error?.message || String(error)}`); // String(error) for non-Error objects
        return null;
    }
}