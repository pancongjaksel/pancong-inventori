const { Pool } = require('pg');

// Konfigurasi lewat environment variable, sesuaikan dengan setup Docker
// di Mac Mini (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD).
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'pancong_inventori',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // Error di koneksi idle di pool — bukan error per-request, log aja
  console.error('[pg pool] Unexpected error on idle client', err);
});

module.exports = { pool };
