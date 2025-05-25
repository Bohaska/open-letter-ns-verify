// lib/db.ts
import { Pool, QueryResult, QueryResultRow } from 'pg';

export interface SignatureRow extends QueryResultRow {
    id: number;
    nationName: string; // Corresponds to "nationName" column in DB
    checksum: string;
    signedAt: Date; // Corresponds to "signedAt" column in DB
}

// Define interface for the cached nation data
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
        // Create signatures table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS signatures (
                                                      id SERIAL PRIMARY KEY,
                                                      "nationName" TEXT NOT NULL UNIQUE,
                                                      checksum TEXT NOT NULL,
                                                      "signedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
        `);

        // Create nation_cache table
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

export async function query<T extends QueryResultRow>(text: string, params?: (string | number | boolean | Date | null)[]): Promise<QueryResult<T>> {
    try {
        return await pool.query<T>(text, params);
    } catch (error) {
        console.error('Error executing database query:', text, params, error);
        throw new Error(`DATABASE_QUERY_ERROR: Failed to execute query: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export const db = {
    get: async (sql: string, params?: (string | number | boolean | Date | null)[]): Promise<any | undefined> => { // Can return SignatureRow or NationCacheRow, hence any for flexibility
        const result = await query<any>(sql, params);
        return result.rows[0];
    },
    all: async (sql: string, params?: (string | number | boolean | Date | null)[]): Promise<any[]> => { // Can return SignatureRow[] or NationCacheRow[], hence any[]
        const result = await query<any>(sql, params);
        return result.rows;
    },
    run: async (sql: string, params?: (string | number | boolean | Date | null)[]): Promise<void> => {
        await query(sql, params);
    },
};