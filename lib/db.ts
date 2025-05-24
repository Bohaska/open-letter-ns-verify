// lib/db.ts
import { Pool, QueryResult, QueryResultRow } from 'pg'; // <--- Import QueryResultRow here

// Define an interface for the signature row structure
// Make SignatureRow extend QueryResultRow to satisfy the pg library's constraints
export interface SignatureRow extends QueryResultRow {
    id: number;
    nationName: string; // Corresponds to "nationName" column in DB
    checksum: string;
    signedAt: Date; // Corresponds to "signedAt" column in DB
}

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

// Generic query function with specific parameter type
export async function query<T extends QueryResultRow>(text: string, params?: (string | number | boolean | Date | null)[]): Promise<QueryResult<T>> { // <--- Added constraint here
    return pool.query<T>(text, params);
}

// Specific functions for common operations to simplify API routes
export const db = {
    get: async (sql: string, params?: (string | number | boolean | Date | null)[]): Promise<SignatureRow | undefined> => {
        const result = await query<SignatureRow>(sql, params);
        return result.rows[0];
    },
    all: async (sql: string, params?: (string | number | boolean | Date | null)[]): Promise<SignatureRow[]> => {
        const result = await query<SignatureRow>(sql, params);
        return result.rows;
    },
    run: async (sql: string, params?: (string | number | boolean | Date | null)[]): Promise<void> => {
        await query(sql, params);
    },
};