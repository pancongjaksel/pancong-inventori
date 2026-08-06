module.exports = {
  databaseUrl: process.env.DATABASE_URL,
  dir: 'migrations',
  migrationsTable: 'pgmigrations',
  direction: 'up',
  checkOrder: true,
};
