exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE transaksi_masuk_nota
    ADD COLUMN IF NOT EXISTS verifikasi_terakhir_oleh_user_id INTEGER REFERENCES users(id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE transaksi_masuk_nota
    DROP COLUMN IF EXISTS verifikasi_terakhir_oleh_user_id;
  `);
};
