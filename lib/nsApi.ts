// lib/nsApi.ts
import { parseStringPromise } from 'xml2js'; // Keep this for XML parsing of other API endpoints
import crypto from 'crypto';

const NS_API_BASE_URL = 'https://www.nationstates.net/cgi-bin/api.cgi';
const USER_AGENT = 'OpenLetterNSVerify/1.0 (contact@example.com - replace with your actual contact)';

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
            console.error(`NationStates API error (verify): ${response.status} - ${response.statusText}`);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return false;
        }

        const textResult = await response.text();
        // The verify endpoint returns plain '1' or '0'
        return textResult.trim() === '1'; // Trim to remove any potential whitespace

    } catch (error) {
        console.error('Error verifying nation with NationStates API:', error);
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
 * @param nationName The name of the nation.
 * @returns An object with nation name, flag URL, and region, or null if data cannot be fetched.
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
            // Cache-control headers are usually handled by Next.js or the server,
            // but can be set for explicit caching behavior if needed.
        });

        if (!response.ok) {
            console.error(`NationStates API error (getNationDisplayData): ${response.status} - ${response.statusText} for nation: ${nationName}`);
            return null;
        }

        const xml = await response.text();
        const result = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true }); // Use explicitArray: false for simpler parsing

        const nationData = result.NATION; // Expect a <NATION> tag

        if (nationData) {
            // Flag URLs are usually /images/flags/{shard_value}.jpg
            const flagUrl = nationData.FLAG;
            const region = nationData.REGION;

            return {
                name: nationData.NAME || nationName, // Use API name if available, otherwise fallback
                flagUrl: flagUrl,
                region: region || 'Unknown Region',
            };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching nation display data for ${nationName}:`, error);
        return null;
    }
}