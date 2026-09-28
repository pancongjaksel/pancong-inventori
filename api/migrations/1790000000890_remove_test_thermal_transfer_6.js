exports.up = (pgm) => {
  pgm.sql(`
    -- Hapus data uji transfer #6: Kertas Thermal 2 pcs, Glagahsari -> Produksi.
    -- Ledger tidak memiliki FK ke transfer, maka dua mutasi terkait dihapus eksplisit.
    DELETE FROM stok_ledger l
    USING item i
    WHERE l.item_id = i.id
      AND i.kode_barang = 'P-007'
      AND l.referensi_tabel = 'transfer_gudang'
      AND l.referensi_id = 6;

    DELETE FROM transfer_gudang t
    USING item i
    WHERE t.id = 6
      AND t.item_id = i.id
      AND i.kode_barang = 'P-007'
      AND t.gudang_asal_id = 3
      AND t.gudang_tujuan_id = 1
      AND t.jumlah = 2;
  `);
};

exports.down = false;
