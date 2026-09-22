/**
 * Deployment-safe bootstrap for the optional Multiple Draw feature.
 * It is idempotent and intentionally does not modify existing draw records.
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });

async function ensureMultipleDraws() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS chit_multiple_draws (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chit_id UUID NOT NULL REFERENCES chits(id) ON DELETE CASCADE,
        source_month_index INT NOT NULL,
        member_id UUID NOT NULL REFERENCES members(id),
        payout_amount NUMERIC(14,2) NOT NULL,
        created_by_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (chit_id, member_id),
        UNIQUE (chit_id, source_month_index, member_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS chit_gap_months (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chit_id UUID NOT NULL REFERENCES chits(id) ON DELETE CASCADE,
        month_index INT NOT NULL,
        source_month_index INT NOT NULL,
        created_by_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (chit_id, month_index)
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_chit_multiple_draws_source ON chit_multiple_draws(chit_id, source_month_index)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chit_gap_months_source ON chit_gap_months(chit_id, source_month_index)');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

ensureMultipleDraws().catch((err) => {
  console.error('Multiple Draw database initialization failed:', err.message);
  process.exit(1);
});
