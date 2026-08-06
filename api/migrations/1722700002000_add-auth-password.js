/**
 * Ganti pendekatan auth dari magic link ke email+password — keputusan
 * direvisi supaya nol dependency eksternal (gak ada SMTP/Gmail yang bisa
 * gagal kirim), lebih cocok buat user yang cuma 1-2 orang (Owner + Admin).
 *
 * password_hash pakai bcrypt (60 karakter tetap, format standar bcrypt).
 * NOT NULL karena migration ini dijalankan SEBELUM seed data user pertama
 * (lihat scripts/buat-user-awal.js) — kalau nanti ternyata ada baris users
 * lama tanpa password (harusnya gak ada, tabel masih kosong), migration ini
 * bakal gagal dan itu sengaja, biar ketauan daripada diem-diem ada user
 * tanpa password.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN password_hash VARCHAR(60) NOT NULL;
    COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt, bukan plaintext. Diisi via scripts/buat-user-awal.js atau endpoint admin buat-user (belum ada, lihat ROADMAP Tahap 2.5).';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE users DROP COLUMN password_hash;`);
};
