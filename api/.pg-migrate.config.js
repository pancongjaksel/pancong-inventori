// CATATAN: CLI node-pg-migrate baca koneksi LANGSUNG dari process.env.DATABASE_URL
// (lihat bin/node-pg-migrate.js), bukan dari field `databaseUrl` di file ini —
// jadi field ini gak berpengaruh ke CLI (`npm run migrate:up`). Override buat
// konteks Docker ada di Dockerfile (rekonstruksi DATABASE_URL dari PG* env var
// sebelum migrate:up jalan), bukan di sini.
module.exports = {
  databaseUrl: process.env.DATABASE_URL,
  dir: 'migrations',
  migrationsTable: 'pgmigrations',
  direction: 'up',
  checkOrder: true,
};
