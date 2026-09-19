exports.up = async (pgm) => {
  await pgm.db.query(`
    ALTER TYPE role_user ADD VALUE 'admin_gudang' AFTER 'admin';
  `);

  console.log('[Migration] Added admin_gudang value to role_user enum');
};

exports.down = async (pgm) => {
  console.log('[Migration DOWN] admin_gudang value cannot be removed from enum (Postgres limitation)');
};
