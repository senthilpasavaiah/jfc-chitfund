/**
 * Ensures the isolated TEST workspace columns exist before the API starts.
 * This is intentionally idempotent and uses node-postgres because this app
 * runs raw SQL at runtime and production deployments do not automatically
 * execute Prisma migrations.
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
});

async function ensureTestWorkspace() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE chits ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE');
    await client.query('ALTER TABLE members ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chits_is_test ON chits(is_test)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_members_is_test ON members(is_test)');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

ensureTestWorkspace().catch((err) => {
  console.error('Test workspace database initialization failed:', err.message);
  process.exit(1);
});
