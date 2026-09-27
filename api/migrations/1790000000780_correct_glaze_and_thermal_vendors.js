exports.up = (pgm) => {
  pgm.sql(`
    -- Vendor master sudah ada; upsert menjaga migrasi aman bila dijalankan di
    -- salinan database lain. Tidak ada stok, qty, atau harga yang diubah.
    INSERT INTO vendor (nama, nama_normalized)
    VALUES ('Toko Pancasari', 'toko pancasari'), ('Samkuanpaper Shopee', 'samkuanpaper shopee')
    ON CONFLICT (nama_normalized) DO NOTHING;

    WITH calon AS (
      SELECT n.id, n.sumber AS sumber_sebelum,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM transaksi_masuk_item mi
            JOIN item i ON i.id = mi.item_id
            WHERE mi.nota_id = n.id AND i.kode_barang = 'G-005'
          ) AND lower(BTRIM(COALESCE(n.sumber, ''))) = 'koepoe official shopee'
            THEN 'Toko Pancasari'
          WHEN EXISTS (
            SELECT 1 FROM transaksi_masuk_item mi
            JOIN item i ON i.id = mi.item_id
            WHERE mi.nota_id = n.id AND i.kode_barang = 'P-007'
          ) AND lower(BTRIM(COALESCE(n.sumber, ''))) <> 'samkuanpaper shopee'
            THEN 'Samkuanpaper Shopee'
        END AS sumber_sesudah
      FROM transaksi_masuk_nota n
    ), diubah AS (
      UPDATE transaksi_masuk_nota n
      SET sumber = calon.sumber_sesudah,
          vendor_id = v.id
      FROM calon
      JOIN vendor v ON v.nama = calon.sumber_sesudah
      WHERE n.id = calon.id
        AND calon.sumber_sesudah IS NOT NULL
        AND n.sumber IS DISTINCT FROM calon.sumber_sesudah
      RETURNING n.id
    )
    INSERT INTO transaksi_masuk_sumber_audit
      (nota_id, sumber_sebelum, sumber_sesudah, diubah_oleh_user_id)
    SELECT calon.id, calon.sumber_sebelum, calon.sumber_sesudah,
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1)
    FROM calon JOIN diubah ON diubah.id = calon.id;
  `);
};

exports.down = false;
