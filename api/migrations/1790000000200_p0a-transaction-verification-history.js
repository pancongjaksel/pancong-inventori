exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS transaksi_verifikasi (
      id BIGSERIAL PRIMARY KEY,
      transaksi_tipe VARCHAR(50) NOT NULL,
      transaksi_id INTEGER NOT NULL,
      versi_transaksi INTEGER NOT NULL,
      aksi_verifikasi VARCHAR(20) NOT NULL CHECK (aksi_verifikasi IN ('approve','reject','revise')),
      dibuat_oleh_role VARCHAR(30),
      dibuat_oleh_crew_id INTEGER REFERENCES crew(id),
      dibuat_oleh_user_id INTEGER REFERENCES users(id),
      diverifikasi_oleh_user_id INTEGER REFERENCES users(id),
      diverifikasi_oleh_role VARCHAR(30),
      waktu_verifikasi TIMESTAMPTZ NOT NULL DEFAULT now(),
      alasan TEXT,
      bukti_nota_ref TEXT,
      nilai_sebelum JSONB,
      nilai_sesudah JSONB,
      idempotency_key VARCHAR(200),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS transaksi_verifikasi_lookup_idx
      ON transaksi_verifikasi(transaksi_tipe, transaksi_id, versi_transaksi);
  `);
};

exports.down = false;
