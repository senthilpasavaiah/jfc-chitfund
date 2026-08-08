const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Idle client errors are logged, not fatal - the pool self-heals.
  // eslint-disable-next-line no-console
  console.error('Unexpected Postgres pool error', err);
});

/**
 * Run a query with automatic client release.
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run a set of operations inside a single transaction.
 * `fn` receives a client and must use it for every query.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
