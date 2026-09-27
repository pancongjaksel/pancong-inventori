exports.up = (pgm) => {
  pgm.sql(`
    -- Koreksi pemilik atas jumlah penerimaan historis, tanpa mengubah harga.
    UPDATE transaksi_masuk_item mi
    SET jumlah = CASE
      WHEN mi.nota_id = 69 AND i.kode_barang = 'BA-001' THEN 400
      WHEN mi.nota_id = 86 AND i.kode_barang = 'BA-008' THEN 6
    END
    FROM item i
    WHERE mi.item_id = i.id
      AND ((mi.nota_id = 69 AND i.kode_barang = 'BA-001' AND mi.jumlah = 480)
        OR (mi.nota_id = 86 AND i.kode_barang = 'BA-008' AND mi.jumlah = 36));

    INSERT INTO transaksi_masuk_qty_audit
      (nota_id, transaksi_masuk_item_id, jumlah_sebelum, jumlah_sesudah, diubah_oleh_user_id, alasan)
    SELECT mi.nota_id, mi.id,
           CASE WHEN mi.nota_id = 69 THEN 480 ELSE 36 END,
           CASE WHEN mi.nota_id = 69 THEN 400 ELSE 6 END,
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1),
           CASE WHEN mi.nota_id = 69
             THEN 'Koreksi pemilik: Tepung Terigu pada Nota #69 seharusnya 400 kg.'
             ELSE 'Koreksi pemilik: Pandan Pasta pada Nota #86 seharusnya 6 pack (36 botol), bukan 36 pack.'
           END
    FROM transaksi_masuk_item mi
    JOIN item i ON i.id = mi.item_id
    WHERE ((mi.nota_id = 69 AND i.kode_barang = 'BA-001' AND mi.jumlah = 400)
       OR (mi.nota_id = 86 AND i.kode_barang = 'BA-008' AND mi.jumlah = 6))
      AND NOT EXISTS (
        SELECT 1 FROM transaksi_masuk_qty_audit audit
        WHERE audit.nota_id = mi.nota_id
          AND audit.transaksi_masuk_item_id = mi.id
          AND audit.jumlah_sebelum = CASE WHEN mi.nota_id = 69 THEN 480 ELSE 36 END
          AND audit.jumlah_sesudah = CASE WHEN mi.nota_id = 69 THEN 400 ELSE 6 END
      );

    INSERT INTO stok_ledger
      (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
    SELECT mi.item_id, n.gudang_id, 'masuk',
           CASE WHEN n.id = 69 THEN -80 ELSE -30 END,
           'transaksi_masuk_nota', n.id, n.tanggal
    FROM transaksi_masuk_nota n
    JOIN transaksi_masuk_item mi ON mi.nota_id = n.id
    JOIN item i ON i.id = mi.item_id
    WHERE ((n.id = 69 AND i.kode_barang = 'BA-001')
       OR (n.id = 86 AND i.kode_barang = 'BA-008'))
      AND NOT EXISTS (
        SELECT 1 FROM stok_ledger sl
        WHERE sl.item_id = mi.item_id
          AND sl.gudang_id = n.gudang_id
          AND sl.tipe_pergerakan = 'masuk'
          AND sl.qty_delta = CASE WHEN n.id = 69 THEN -80 ELSE -30 END
          AND sl.referensi_tabel = 'transaksi_masuk_nota'
          AND sl.referensi_id = n.id
      );
  `);
};

exports.down = false;
