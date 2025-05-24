// pages/api/admin/logout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Clear the authentication cookie
    res.setHeader('Set-Cookie', serialize('admin_logged_in', 'false', {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        maxAge: 0, // Expires immediately
        path: '/',
    }));

    return res.status(200).json({ message: 'Logged out successfully!' });
}