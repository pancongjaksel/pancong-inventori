exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS transaksi_masuk_sumber_audit (
      id BIGSERIAL PRIMARY KEY,
      nota_id INTEGER NOT NULL REFERENCES transaksi_masuk_nota(id) ON DELETE CASCADE,
      sumber_sebelum TEXT,
      sumber_sesudah TEXT NOT NULL,
      diubah_oleh_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS transaksi_masuk_sumber_audit_nota_idx
      ON transaksi_masuk_sumber_audit(nota_id, created_at DESC);
  `);
};

exports.down = false;
