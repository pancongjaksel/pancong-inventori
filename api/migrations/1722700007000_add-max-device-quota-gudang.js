/**
 * Kuota device per gudang serving (UGM, Glagahsari) — jaga-jaga biar HP
 * gak numpuk gak jelas di 1 gudang. Default 5, admin bisa ubah lewat
 * halaman Manajemen Device.
 *
 * Sengaja ditaruh di `gudang` (bukan `outlet`) — device_gudang.gudang_id
 * itu yang beneran punya relasi ke device, outlet gak pernah punya device
 * sama sekali (lihat model data: crew pilih outlet TUJUAN saat submit
 * sesi pengambilan, itu beda konsep dari device yang dipakainya).
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE gudang ADD COLUMN max_device_quota INTEGER NOT NULL DEFAULT 5 CHECK (max_device_quota >= 0);
    COMMENT ON COLUMN gudang.max_device_quota IS
      'Batas maksimal device_gudang aktif per gudang. Cuma relevan buat gudang tipe serving (Produksi gak bisa punya device sama sekali, lihat trg_validasi_device_bukan_produksi).';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE gudang DROP COLUMN max_device_quota;`);
};
