// pages/api/signatures.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db, SignatureRow } from '../../lib/db'; // Import db and SignatureRow
import { getNationDisplayData } from '../../lib/nsApi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const allSignatures: SignatureRow[] = await db.all('SELECT id, "nationName", "signedAt" FROM signatures ORDER BY "signedAt" ASC');

        const enrichedSignatures = await Promise.all(
            allSignatures.map(async (signature: SignatureRow) => { // Use SignatureRow here
                const displayData = await getNationDisplayData(signature.nationName);
                return {
                    ...signature,
                    flagUrl: displayData?.flagUrl || '',
                    region: displayData?.region || 'Unknown Region',
                };
            })
        );

        return res.status(200).json(enrichedSignatures);
    } catch (error) {
        console.error('Error fetching signatures with display data:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}