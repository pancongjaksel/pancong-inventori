exports.up = (pgm) => {
  pgm.sql(`
    -- Riwayat tetap ada, tetapi variasi lama tidak boleh muncul lagi pada dropdown.
    UPDATE vendor
    SET aktif = false, updated_at = now()
    WHERE nama_normalized IN ('cv berkah manis sejahtera', 'cv. berkah manis sejahtera');
  `);
};

exports.down = false;
