/**
 * Migration ini dibuat karena migration sebelumnya
 * (1788540737271_add-aktivitas-dan-notifikasi) tercatat sudah run
 * di pgmigrations tapi DDL-nya tidak dieksekusi ke DB.
 * Pakai IF NOT EXISTS supaya aman dijalankan ulang.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS aktivitas_pengambilan (
      id SERIAL PRIMARY KEY,
      sesi_pengambilan_id INTEGER NOT NULL
        REFERENCES sesi_pengambilan_crew(id) ON DELETE CASCADE,
      tipe VARCHAR(50) NOT NULL,
      actor_tipe VARCHAR(20) NOT NULL,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_gudang_id INTEGER REFERENCES gudang(id) ON DELETE SET NULL,
      actor_nama VARCHAR(100),
      judul VARCHAR(200) NOT NULL,
      deskripsi TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS aktivitas_pengambilan_sesi_id_idx
      ON aktivitas_pengambilan(sesi_pengambilan_id);

    CREATE INDEX IF NOT EXISTS aktivitas_pengambilan_created_at_idx
      ON aktivitas_pengambilan(created_at);

    CREATE TABLE IF NOT EXISTS notifikasi (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      crew_gudang_id INTEGER REFERENCES gudang(id) ON DELETE CASCADE,
      crew_nama VARCHAR(100),
      tipe VARCHAR(50) NOT NULL,
      judul VARCHAR(200) NOT NULL,
      pesan TEXT,
      reference_tipe VARCHAR(50),
      reference_id INTEGER,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS notifikasi_user_id_idx
      ON notifikasi(user_id);

    CREATE INDEX IF NOT EXISTS notifikasi_crew_idx
      ON notifikasi(crew_gudang_id, crew_nama);

    CREATE INDEX IF NOT EXISTS notifikasi_read_at_idx
      ON notifikasi(read_at);

    CREATE INDEX IF NOT EXISTS notifikasi_created_at_idx
      ON notifikasi(created_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS notifikasi;
    DROP TABLE IF EXISTS aktivitas_pengambilan;
  `);
};
