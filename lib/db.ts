// lib/db.ts
import { Pool, QueryResult } from 'pg';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL, // Vercel Postgres env var
    ssl: {
        rejectUnauthorized: false, // Required for Vercel Postgres connections
    },
});

// Function to ensure tables exist
export async function initializeDatabase() {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS signatures (
        id SERIAL PRIMARY KEY,
        "nationName" TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        "signedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
        console.log('Database initialized successfully or tables already exist.');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error; // Re-throw to indicate a critical error
    }
}

interface SignatureRow {
    id: number;
    nationName: string;
    checksum: string;
    signedAt: Date;
}

// Generic query function
export async function query<T>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return pool.query<T>(text, params);
}

// Specific functions for common operations to simplify API routes
export const db = {
    get: async (sql: string, params?: any[]): Promise<SignatureRow | undefined> => {
        const result = await query<SignatureRow>(sql, params);
        return result.rows[0];
    },
    all: async (sql: string, params?: any[]): Promise<SignatureRow[]> => {
        const result = await query<SignatureRow>(sql, params);
        return result.rows;
    },
    run: async (sql: string, params?: any[]): Promise<void> => {
        await query(sql, params);
    },
};