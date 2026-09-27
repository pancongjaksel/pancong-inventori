exports.up = (pgm) => {
  pgm.sql(`
    -- Harga Gula Pasir pada Nota #68 dikonfirmasi pemilik: Rp17.500/kg.
    -- Hanya nilai pembelian yang berubah; jumlah dan stok tetap.
    INSERT INTO transaksi_masuk_harga_audit
      (nota_id, transaksi_masuk_item_id, harga_sebelum, harga_sesudah, diubah_oleh_user_id)
    SELECT mi.nota_id, mi.id, mi.harga_beli, 17500,
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1)
    FROM transaksi_masuk_item mi
    JOIN item i ON i.id = mi.item_id
    WHERE mi.nota_id = 68
      AND i.kode_barang = 'BA-007'
      AND mi.harga_beli = 17000
      AND NOT EXISTS (
        SELECT 1 FROM transaksi_masuk_harga_audit audit
        WHERE audit.nota_id = mi.nota_id
          AND audit.transaksi_masuk_item_id = mi.id
          AND audit.harga_sebelum = 17000
          AND audit.harga_sesudah = 17500
      );

    UPDATE transaksi_masuk_item mi
    SET harga_beli = 17500
    FROM item i
    WHERE mi.nota_id = 68
      AND i.id = mi.item_id
      AND i.kode_barang = 'BA-007'
      AND mi.harga_beli = 17000;
  `);
};

exports.down = false;
