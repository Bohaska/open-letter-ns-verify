// pages/api/admin/signatures.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db'; // Import db directly
import { isAuthenticated } from '../../../lib/auth';
import { getNationDisplayData } from '../../../lib/nsApi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'GET') {
        try {
            const allSignatures = await db.all('SELECT id, "nationName", checksum, "signedAt" FROM signatures ORDER BY "signedAt" DESC');

            const enrichedSignatures = await Promise.all(
                allSignatures.map(async (signature: any) => {
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
            console.error('Error fetching all signatures for admin:', error);
            return res.status(500).json({ error: 'Internal server error.' });
        }
    } else if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'ID is required to delete a signature.' });
        }
        try {
            await db.run('DELETE FROM signatures WHERE id = $1', [id]);
            return res.status(200).json({ message: `Signature ${id} deleted.` });
        } catch (error) {
            console.error('Error deleting signature:', error);
            return res.status(500).json({ error: 'Internal server error.' });
        }
    } else {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
}