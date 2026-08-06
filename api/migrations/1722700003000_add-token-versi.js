/**
 * token_versi dipakai buat "paksa logout" tanpa perlu nunggu token JWT
 * expired secara alami — naikkan angka ini di baris user/device tsb, dan
 * semua token lama (yang nyimpen angka versi sebelumnya) otomatis ketolak
 * di middleware (lihat middleware/authMiddleware.js).
 *
 * Dibutuhkan khusus buat token Device, karena umurnya sengaja dibuat ~10
 * tahun (device nempel permanen di gudang) — tanpa token_versi, satu-satunya
 * cara "cabut akses" device yang HP-nya hilang adalah nunggu 10 tahun atau
 * ganti JWT_SECRET (yang bakal nge-invalidate SEMUA device sekaligus, bukan
 * cuma yang hilang).
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN token_versi INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE device_gudang ADD COLUMN token_versi INTEGER NOT NULL DEFAULT 1;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE users DROP COLUMN token_versi;
    ALTER TABLE device_gudang DROP COLUMN token_versi;
  `);
};
