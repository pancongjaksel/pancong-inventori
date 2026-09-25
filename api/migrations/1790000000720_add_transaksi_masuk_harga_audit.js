exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS transaksi_masuk_harga_audit (
      id BIGSERIAL PRIMARY KEY,
      nota_id INTEGER NOT NULL REFERENCES transaksi_masuk_nota(id) ON DELETE CASCADE,
      transaksi_masuk_item_id INTEGER NOT NULL REFERENCES transaksi_masuk_item(id) ON DELETE CASCADE,
      harga_sebelum NUMERIC(14,2),
      harga_sesudah NUMERIC(14,2) NOT NULL CHECK (harga_sesudah > 0),
      diubah_oleh_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS transaksi_masuk_harga_audit_nota_idx
      ON transaksi_masuk_harga_audit(nota_id, created_at DESC);
  `);
};

exports.down = false;
