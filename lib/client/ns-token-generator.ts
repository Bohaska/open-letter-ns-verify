// lib/client/ns-token-generator.ts
'use client'; // This directive is crucial for client-side utilities.

import crypto from 'crypto'; // This crypto module is available in browser environments (WebCrypto API) or polyfilled by Next.js for client.

/**
 * Generates a consistent token for NationStates verification based on the nation name.
 * This token is used to ensure the checksum is site-specific.
 * This function is safe to run on the client-side.
 * @param nationName The name of the nation.
 * @returns A SHA256 hash as the token.
 */
export function generateNSToken(nationName: string): string {
    // We use NEXT_PUBLIC_ for client-side accessible environment variables.
    if (!process.env.NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET) {
        // In a production build, this error would typically be caught earlier
        // by ensuring all necessary env vars are set.
        console.error('NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET is not set. Client-side token generation may fail.');
        // Provide a fallback or throw an error if you consider this fatal
        throw new Error('Missing client-side token secret.');
    }
    // Note: Node's 'crypto' module methods might be polyfilled by Next.js or replaced with WebCrypto APIs.
    // For basic hashing like Hmac, it usually works.
    return crypto
        .createHmac('sha256', process.env.NEXT_PUBLIC_NS_VERIFY_TOKEN_SECRET)
        .update(nationName.toLowerCase())
        .digest('hex');
}