/**
 * Pisah aturan unique stok_opname per lokasi_tipe:
 * - Outlet: TETAP 1x per bulan (perilaku sekarang, gak berubah).
 * - Gudang: dari 1x per periode (bulan) jadi kunci ke TANGGAL spesifik —
 *   boleh banyak SO gudang dalam 1 bulan, tapi tetap dicegah dobel-input
 *   di tanggal yang sama.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE stok_opname DROP CONSTRAINT uq_opname_periode;

    CREATE UNIQUE INDEX uq_opname_outlet_periode
      ON stok_opname (outlet_id, item_id, periode)
      WHERE lokasi_tipe = 'outlet';

    CREATE UNIQUE INDEX uq_opname_gudang_tanggal
      ON stok_opname (gudang_id, item_id, tanggal)
      WHERE lokasi_tipe = 'gudang';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX uq_opname_outlet_periode;
    DROP INDEX uq_opname_gudang_tanggal;

    ALTER TABLE stok_opname
      ADD CONSTRAINT uq_opname_periode UNIQUE (lokasi_tipe, gudang_id, outlet_id, item_id, periode);
  `);
};
