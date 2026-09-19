exports.up = async (pgm) => {
  pgm.createTable('device_admin_gudang', {
    id: { type: 'serial', primaryKey: true },
    nama_device: { type: 'varchar(50)', notNull: true },
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"(id)',
    },
    aktif: { type: 'boolean', notNull: true, default: true },
    token_versi: { type: 'integer', notNull: true, default: 1 },
    created_at: { type: 'timestamptz', notNull: true, default: 'now()' },
  });

  pgm.createConstraint('device_admin_gudang', 'uq_admin_gudang_device_nama', {
    unique: ['nama_device'],
  });

  pgm.createIndex('device_admin_gudang', ['user_id']);
  pgm.createIndex('device_admin_gudang', ['aktif']);

  console.log('[Migration] Created table device_admin_gudang');

  // password_hash NOT NULL secara sengaja di skema (lihat migration
  // add-auth-password) — jadi bukan NULL, tapi bcrypt hash dari nilai random
  // yang di-generate sekali lalu dibuang, gak pernah disimpan/dicatat di
  // mana pun. Efeknya sama kayak "tidak ada password yang bisa dipakai"
  // (gak ada yang tau plaintext-nya, termasuk kita), tapi tetap penuhi
  // constraint NOT NULL tanpa melemahkan aturan itu buat user lain.
  await pgm.db.query(
    `INSERT INTO users (nama, email, password_hash, role, token_versi)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING`,
    [
      'Admin Gudang',
      'admin-gudang@pancongjaksel.internal',
      '$2b$12$pO08PZRaR.jBaEej3gTtE.6YlUTpkl0L98x69XREZm/f7RqvUxBFG',
      'admin_gudang',
      1,
    ]
  );

  console.log('[Migration] Seeded user "Admin Gudang" with unusable password hash (device-QR auth only)');
};

exports.down = (pgm) => {
  pgm.dropTable('device_admin_gudang');
  console.log('[Migration DOWN] Dropped device_admin_gudang table (user "Admin Gudang" remains)');
};
