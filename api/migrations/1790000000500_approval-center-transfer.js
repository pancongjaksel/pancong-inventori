exports.up = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN ALTER TYPE status_transfer_enum ADD VALUE IF NOT EXISTS 'menunggu_approval'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    ALTER TABLE transfer_gudang ADD COLUMN IF NOT EXISTS sumber_transaksi VARCHAR(30);
    ALTER TABLE transfer_gudang ADD COLUMN IF NOT EXISTS dibuat_oleh_role VARCHAR(30);
    ALTER TABLE transfer_gudang ADD COLUMN IF NOT EXISTS dibuat_oleh_user_id INTEGER REFERENCES users(id);
    ALTER TABLE transfer_gudang ADD COLUMN IF NOT EXISTS status_verifikasi VARCHAR(30) NOT NULL DEFAULT 'approved';
    ALTER TABLE transfer_gudang ADD COLUMN IF NOT EXISTS versi_transaksi INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE transfer_gudang ADD COLUMN IF NOT EXISTS verifikasi_terakhir_at TIMESTAMPTZ;
    ALTER TABLE transfer_gudang ADD COLUMN IF NOT EXISTS verifikasi_terakhir_oleh_user_id INTEGER REFERENCES users(id);
    ALTER TABLE transfer_gudang ADD COLUMN IF NOT EXISTS verifikasi_terakhir_oleh_role VARCHAR(30);
    ALTER TABLE transfer_gudang ADD COLUMN IF NOT EXISTS catatan_verifikasi TEXT;
    ALTER TABLE transfer_gudang ADD COLUMN IF NOT EXISTS bukti_verifikasi_ref TEXT;
    CREATE INDEX IF NOT EXISTS transfer_approval_idx ON transfer_gudang(status, sumber_transaksi, status_verifikasi);
    CREATE OR REPLACE FUNCTION fn_transfer_ke_ledger() RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'INSERT' AND NEW.status = 'dikirim' THEN
        INSERT INTO stok_ledger (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal) VALUES (NEW.item_id, NEW.gudang_asal_id, 'transfer_keluar', -NEW.jumlah, 'transfer_gudang', NEW.id, NEW.tanggal_kirim);
      ELSIF TG_OP = 'UPDATE' AND OLD.status = 'menunggu_approval' AND NEW.status = 'dikirim' THEN
        INSERT INTO stok_ledger (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal) VALUES (NEW.item_id, NEW.gudang_asal_id, 'transfer_keluar', -NEW.jumlah, 'transfer_gudang', NEW.id, NEW.tanggal_kirim);
      ELSIF TG_OP = 'UPDATE' AND NEW.status = 'diterima' AND OLD.status = 'dikirim' THEN
        INSERT INTO stok_ledger (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal) VALUES (NEW.item_id, NEW.gudang_tujuan_id, 'transfer_masuk', NEW.jumlah, 'transfer_gudang', NEW.id, NEW.tanggal_terima);
      END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
  `);
};
exports.down = false;
