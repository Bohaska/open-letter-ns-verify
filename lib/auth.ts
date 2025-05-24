// lib/auth.ts
import bcrypt from 'bcrypt';
import { NextApiRequest } from 'next'; // Import NextApiRequest

const SALT_ROUNDS = 10; // For bcrypt hashing

export async function hashAdminPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function compareAdminPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// Use NextApiRequest for the request object
export function isAuthenticated(req: NextApiRequest): boolean {
    // In a real application, you'd use a session management library like NextAuth.js
    // For this example, we'll use a simple cookie-based check.
    return req.cookies.admin_logged_in === 'true';
}