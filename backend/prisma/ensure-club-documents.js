/**
 * Ensures the Documents feature's database objects exist before the API starts.
 * The project uses node-postgres/raw SQL at runtime, so this is intentionally
 * independent of Prisma's migration table/history.
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
});

async function ensureClubDocuments() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_category') THEN
          CREATE TYPE document_category AS ENUM ('ACCOUNTS', 'REGISTRATION', 'BYLAWS', 'OTHER');
        END IF;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS club_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        category document_category NOT NULL DEFAULT 'OTHER',
        description TEXT,
        file_name TEXT NOT NULL,
        file_mime_type TEXT NOT NULL,
        file_data TEXT NOT NULL,
        uploaded_by_id UUID NOT NULL REFERENCES users(id),
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_club_documents_category ON club_documents(category)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_club_documents_uploaded_at ON club_documents(uploaded_at DESC)');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

ensureClubDocuments().catch((err) => {
  console.error('Documents database initialization failed:', err.message);
  process.exit(1);
});
