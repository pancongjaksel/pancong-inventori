/**
 * device_admin_gudang.created_at kepasang default LITERAL (timestamp beku
 * pas migration create-table dijalanin), bukan pemanggilan now() yang
 * dinamis — akibat pgm.createTable({ default: 'now()' }) diperlakukan
 * node-pg-migrate sebagai string literal, bukan raw SQL. Perbaiki pakai
 * ALTER COLUMN ... SET DEFAULT now() langsung (raw SQL, gak ada ambiguitas).
 */
exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE device_admin_gudang ALTER COLUMN created_at SET DEFAULT now();`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE device_admin_gudang ALTER COLUMN created_at DROP DEFAULT;`);
};
