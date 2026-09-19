exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE sesi_pengambilan_crew ADD COLUMN IF NOT EXISTS sumber_transaksi VARCHAR(30) NOT NULL DEFAULT 'legacy';
    ALTER TABLE sesi_pengambilan_crew ADD COLUMN IF NOT EXISTS dibuat_oleh_role VARCHAR(30) NOT NULL DEFAULT 'legacy';
    ALTER TABLE sesi_pengambilan_crew ADD COLUMN IF NOT EXISTS dibuat_oleh_user_id INTEGER REFERENCES users(id);
    ALTER TABLE sesi_pengambilan_crew ADD COLUMN IF NOT EXISTS versi_transaksi INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE sesi_pengambilan_crew ADD COLUMN IF NOT EXISTS status_verifikasi VARCHAR(30) NOT NULL DEFAULT 'unverified';
    ALTER TABLE sesi_pengambilan_crew ADD COLUMN IF NOT EXISTS verifikasi_terakhir_at TIMESTAMPTZ;
    ALTER TABLE sesi_pengambilan_crew ADD COLUMN IF NOT EXISTS verifikasi_terakhir_oleh_user_id INTEGER REFERENCES users(id);
    ALTER TABLE sesi_pengambilan_crew ADD COLUMN IF NOT EXISTS verifikasi_terakhir_oleh_role VARCHAR(30);
    ALTER TABLE transaksi_masuk_nota ADD COLUMN IF NOT EXISTS sumber_transaksi VARCHAR(30);
    ALTER TABLE transaksi_masuk_nota ADD COLUMN IF NOT EXISTS dibuat_oleh_user_id INTEGER REFERENCES users(id);
    ALTER TABLE transaksi_masuk_nota ADD COLUMN IF NOT EXISTS versi_transaksi INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE transaksi_masuk_nota ADD COLUMN IF NOT EXISTS verifikasi_terakhir_at TIMESTAMPTZ;
    ALTER TABLE transaksi_masuk_nota ADD COLUMN IF NOT EXISTS verifikasi_terakhir_oleh_role VARCHAR(30);
    ALTER TABLE transaksi_masuk ADD COLUMN IF NOT EXISTS sumber_transaksi VARCHAR(30);
    ALTER TABLE transaksi_masuk ADD COLUMN IF NOT EXISTS dibuat_oleh_user_id INTEGER REFERENCES users(id);
    ALTER TABLE transaksi_masuk ADD COLUMN IF NOT EXISTS versi_transaksi INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE transaksi_masuk ADD COLUMN IF NOT EXISTS verifikasi_terakhir_at TIMESTAMPTZ;
    ALTER TABLE transaksi_masuk ADD COLUMN IF NOT EXISTS verifikasi_terakhir_oleh_role VARCHAR(30);
    CREATE INDEX IF NOT EXISTS nota_source_status_idx ON transaksi_masuk_nota(sumber_transaksi, status_verifikasi);
    CREATE INDEX IF NOT EXISTS pickup_source_status_idx ON sesi_pengambilan_crew(sumber_transaksi, status_verifikasi);
  `);
};

exports.down = false;
