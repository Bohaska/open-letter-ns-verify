// lib/db.ts
import { Pool, QueryResult, QueryResultRow } from 'pg';

export interface SignatureRow extends QueryResultRow {
    id: number;
    nationName: string;
    checksum: string;
    signedAt: Date;
}

export interface NationCacheRow extends QueryResultRow {
    nationName: string;
    flagUrl: string;
    region: string;
    lastUpdated: Date;
}

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
    throw new Error('DATABASE_CONNECTION_ERROR: POSTGRES_URL environment variable is not set. Cannot connect to the database. Please ensure it is configured for "Build and Runtime" on Vercel.');
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false,
    },
});

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

        await pool.query(`
            CREATE TABLE IF NOT EXISTS nation_cache (
                                                        "nationName" TEXT PRIMARY KEY,
                                                        "flagUrl" TEXT NOT NULL,
                                                        region TEXT NOT NULL,
                                                        "lastUpdated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
        `);

        console.log('Database initialized successfully or tables already exist.');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw new Error(`DATABASE_INITIALIZATION_ERROR: Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Define a more flexible type for query parameters
type QueryParam = string | number | boolean | Date | null | (string | number | boolean | Date | null)[]; // Allow arrays as elements

export async function query<T extends QueryResultRow>(text: string, params?: QueryParam[]): Promise<QueryResult<T>> { // <--- Changed params type here
    try {
        return await pool.query<T>(text, params);
    } catch (error) {
        console.error('Error executing database query:', text, params, error);
        throw new Error(`DATABASE_QUERY_ERROR: Failed to execute query: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export const db = {
    get: async (sql: string, params?: QueryParam[]): Promise<any | undefined> => { // <--- Changed params type here
        const result = await query<any>(sql, params);
        return result.rows[0];
    },
    all: async (sql: string, params?: QueryParam[]): Promise<any[]> => { // <--- Changed params type here
        const result = await query<any>(sql, params);
        return result.rows;
    },
    run: async (sql: string, params?: QueryParam[]): Promise<void> => { // <--- Changed params type here
        await query(sql, params);
    },
};