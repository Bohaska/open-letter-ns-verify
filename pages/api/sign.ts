// pages/api/sign.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../lib/db'; // Import db directly
import { verifyNation } from '../../lib/nsApi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { nationName, checksum } = req.body;

    if (!nationName || !checksum) {
        return res.status(400).json({ error: 'Nation name and checksum are required.' });
    }

    try {
        const isVerified = await verifyNation(nationName, checksum);

        if (!isVerified) {
            return res.status(400).json({ error: 'NationStates verification failed. Please ensure the nation name and checksum are correct, and you are logged into NationStates as that nation.' });
        }

        // Check if nation already exists
        const existingSignature = await db.get('SELECT id FROM signatures WHERE "nationName" = $1', [nationName]); // Use $1 for pg parameters

        if (existingSignature) {
            await db.run('UPDATE signatures SET checksum = $1, "signedAt" = NOW() WHERE "nationName" = $2', [checksum, nationName]);
            return res.status(200).json({ message: 'You have already signed the letter. Your signature has been re-recorded with the current timestamp.' });
        } else {
            await db.run('INSERT INTO signatures ("nationName", checksum) VALUES ($1, $2)', [nationName, checksum]); // No need to provide signedAt if default is NOW()
            return res.status(200).json({ message: 'Thank you for signing the letter! Your signature has been added.' });
        }

    } catch (error) {
        console.error('Error processing signature:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}