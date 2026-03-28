const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

async function connectDB() {
  const client = await pool.connect();
  console.log('[db] PostgreSQL connected');
  client.release();
}

// Convenience query helper
const db = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};

module.exports = { db, connectDB };