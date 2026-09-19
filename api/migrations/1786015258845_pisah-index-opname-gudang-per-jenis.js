/**
 * uq_opname_gudang_tanggal (dari migration sebelumnya) gak tau soal
 * jenis_opname — bakal salah nolak/salah izinin kombinasi bulanan+dadakan
 * di hari yang sama, atau dua opname bulanan di bulan yang sama tapi beda
 * tanggal. Ganti jadi 2 index terpisah, sesuai cabang logic di
 * stokOpnameValidator.validasiBelumAdaOpname:
 * - Bulanan: 1x per periode (sama kayak outlet).
 * - Dadakan: 1x per tanggal (boleh berkali-kali per bulan, beda hari).
 */
exports.up = (pgm) => {
  pgm.sql(`
    DROP INDEX uq_opname_gudang_tanggal;

    CREATE UNIQUE INDEX uq_opname_gudang_bulanan_periode
      ON stok_opname (gudang_id, item_id, periode)
      WHERE lokasi_tipe = 'gudang' AND jenis_opname = 'bulanan';

    CREATE UNIQUE INDEX uq_opname_gudang_dadakan_tanggal
      ON stok_opname (gudang_id, item_id, tanggal)
      WHERE lokasi_tipe = 'gudang' AND jenis_opname = 'dadakan';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX uq_opname_gudang_bulanan_periode;
    DROP INDEX uq_opname_gudang_dadakan_tanggal;

    CREATE UNIQUE INDEX uq_opname_gudang_tanggal
      ON stok_opname (gudang_id, item_id, tanggal)
      WHERE lokasi_tipe = 'gudang';
  `);
};
