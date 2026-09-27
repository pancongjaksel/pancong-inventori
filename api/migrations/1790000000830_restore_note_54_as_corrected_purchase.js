exports.up = (pgm) => {
  pgm.sql(`
    -- Nota #54 tetap pembelian. Koreksi sebelumnya hanya memperbaiki jumlah
    -- Kertas Thermal dari 10 menjadi 100 pcs, bukan membatalkan belanjanya.
    -- Pulihkan 10 pcs yang dulu direversal dan tandai sebagai revisi admin.
    INSERT INTO stok_ledger
      (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
    SELECT sl.item_id, sl.gudang_id, 'masuk', -sl.qty_delta,
           'koreksi_transaksi', sl.referensi_id, now()
    FROM stok_ledger sl
    WHERE sl.referensi_tabel = 'koreksi_transaksi'
      AND sl.referensi_id = (
        SELECT id FROM koreksi_transaksi
        WHERE tabel_transaksi = 'transaksi_masuk_nota' AND transaksi_asal_id = 54
        ORDER BY id LIMIT 1
      )
      AND sl.tipe_pergerakan = 'koreksi_reversal'
      AND NOT EXISTS (
        SELECT 1 FROM stok_ledger restored
        WHERE restored.referensi_tabel = 'koreksi_transaksi'
          AND restored.referensi_id = sl.referensi_id
          AND restored.item_id = sl.item_id
          AND restored.gudang_id = sl.gudang_id
          AND restored.tipe_pergerakan = 'masuk'
          AND restored.qty_delta = -sl.qty_delta
      );

    UPDATE transaksi_masuk_nota
    SET label_status = 'Direvisi Admin',
        catatan_verifikasi = 'Koreksi jumlah: Kertas Thermal pada Nota #54 adalah pembelian 100 pcs, bukan pembatalan transaksi.'
    WHERE id = 54;
  `);
};

exports.down = false;
