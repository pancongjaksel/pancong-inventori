exports.up = (pgm) => {
  // Item kategori "Bahan Adonan" cuma relevan di Gudang Produksi (gudang_default_id
  // semua item Bahan Adonan konsisten = 1), gak perlu tampil di gudang cabang.
  // Kolom ini nandain pengecualian (mis. Pandan Pasta) yang tetap perlu tampil
  // di semua gudang meski kategorinya Bahan Adonan.
  pgm.addColumn('item', {
    selalu_tampil_semua_gudang: { type: 'boolean', notNull: true, default: false },
  });

  pgm.sql(`UPDATE item SET selalu_tampil_semua_gudang = true WHERE id = 8`); // Pandan Pasta (BA-008)
};

exports.down = (pgm) => {
  pgm.dropColumn('item', 'selalu_tampil_semua_gudang');
};
