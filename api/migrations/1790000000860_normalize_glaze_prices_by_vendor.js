exports.up = (pgm) => {
  pgm.sql(`
    -- Pola harga yang dikonfirmasi pemilik: Pancasari Rp35.000, BMS Rp33.800.
    -- Harga pembelian diubah tanpa menyentuh jumlah maupun stok.
    UPDATE transaksi_masuk_item mi
    SET harga_beli = CASE
      WHEN n.id IN (37, 38) THEN 35000
      WHEN n.id IN (27, 28, 43) THEN 33800
    END
    FROM transaksi_masuk_nota n, item i
    WHERE mi.nota_id = n.id AND i.id = mi.item_id
      AND ((n.id IN (37, 38) AND i.kode_barang = 'G-002' AND mi.harga_beli = 33800)
        OR (n.id IN (27, 28) AND i.kode_barang = 'G-005' AND mi.harga_beli = 35000)
        OR (n.id = 43 AND i.kode_barang = 'G-003' AND mi.harga_beli = 50000));

    INSERT INTO transaksi_masuk_harga_audit
      (nota_id, transaksi_masuk_item_id, harga_sebelum, harga_sesudah, diubah_oleh_user_id)
    SELECT mi.nota_id, mi.id,
           CASE WHEN mi.nota_id IN (37, 38) THEN 33800
                WHEN mi.nota_id IN (27, 28) THEN 35000
                ELSE 50000 END,
           mi.harga_beli,
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1)
    FROM transaksi_masuk_item mi
    JOIN item i ON i.id = mi.item_id
    WHERE ((mi.nota_id IN (37, 38) AND i.kode_barang = 'G-002' AND mi.harga_beli = 35000)
        OR (mi.nota_id IN (27, 28) AND i.kode_barang = 'G-005' AND mi.harga_beli = 33800)
        OR (mi.nota_id = 43 AND i.kode_barang = 'G-003' AND mi.harga_beli = 33800))
      AND NOT EXISTS (
        SELECT 1 FROM transaksi_masuk_harga_audit audit
        WHERE audit.nota_id = mi.nota_id
          AND audit.transaksi_masuk_item_id = mi.id
          AND audit.harga_sebelum = CASE WHEN mi.nota_id IN (37, 38) THEN 33800
                                         WHEN mi.nota_id IN (27, 28) THEN 35000
                                         ELSE 50000 END
          AND audit.harga_sesudah = mi.harga_beli
      );
  `);
};

exports.down = false;
