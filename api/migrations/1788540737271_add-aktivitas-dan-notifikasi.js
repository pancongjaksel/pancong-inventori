exports.up = (pgm) => {
  // ── Aktivitas Pengambilan ─────────────────────────────────────────
  pgm.createTable('aktivitas_pengambilan', {
    id: { type: 'serial', primaryKey: true },
    sesi_pengambilan_id: {
      type: 'integer',
      notNull: true,
      references: '"sesi_pengambilan_crew"',
      onDelete: 'CASCADE',
    },
    tipe: { type: 'varchar(50)', notNull: true },
    // Actor — hanya salah satu yang diisi
    actor_tipe: { type: 'varchar(20)', notNull: true }, // 'crew'|'admin'|'owner'|'system'
    actor_user_id: { type: 'integer', references: '"users"', onDelete: 'SET NULL' },
    actor_gudang_id: { type: 'integer', references: '"gudang"', onDelete: 'SET NULL' }, // untuk crew
    actor_nama: { type: 'varchar(100)' }, // nama crew/user saat kejadian
    // Konten
    judul: { type: 'varchar(200)', notNull: true },
    deskripsi: { type: 'text' },
    metadata: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('aktivitas_pengambilan', 'sesi_pengambilan_id');
  pgm.createIndex('aktivitas_pengambilan', 'created_at');

  // ── Notifikasi ────────────────────────────────────────────────────
  pgm.createTable('notifikasi', {
    id: { type: 'serial', primaryKey: true },
    // Penerima — salah satu diisi (user_id untuk admin/owner, crew fields untuk crew)
    user_id: { type: 'integer', references: '"users"', onDelete: 'CASCADE' },
    crew_gudang_id: { type: 'integer', references: '"gudang"', onDelete: 'CASCADE' }, // gudang crew penerima
    crew_nama: { type: 'varchar(100)' }, // nama crew penerima (matched ke JWT)
    // Konten
    tipe: { type: 'varchar(50)', notNull: true },
    judul: { type: 'varchar(200)', notNull: true },
    pesan: { type: 'text' },
    // Referensi ke transaksi asal (deep link)
    reference_tipe: { type: 'varchar(50)' }, // 'sesi_pengambilan'|'opname_outlet'
    reference_id: { type: 'integer' },
    // State
    read_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('notifikasi', 'user_id');
  pgm.createIndex('notifikasi', ['crew_gudang_id', 'crew_nama']);
  pgm.createIndex('notifikasi', 'read_at');
  pgm.createIndex('notifikasi', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('notifikasi');
  pgm.dropTable('aktivitas_pengambilan');
};
