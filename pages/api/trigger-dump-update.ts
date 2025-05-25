// pages/api/trigger-dump-update.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { processDailyNationDump } from '../../lib/nsApi'; // Import the new function

// IMPORTANT: SECURE THIS ENDPOINT IN PRODUCTION!
// You should add a secret key here to prevent unauthorized calls.
// E.g., check req.headers['x-api-key'] against an environment variable.
// const AUTH_SECRET = process.env.DUMP_TRIGGER_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') { // Recommend POST or a specific HTTP method for tasks
        return res.status(405).json({ message: 'Method Not Allowed' });
    }


    try {
        const result = await processDailyNationDump();
        if (result.success) {
            return res.status(200).json({ message: result.message, nationsProcessed: result.nationsProcessed });
        } else {
            return res.status(500).json({ message: result.message });
        }
    } catch (error: any) {
        console.error('Error in trigger-dump-update API route:', error);
        return res.status(500).json({ message: `Internal Server Error: ${error.message}` });
    }
}