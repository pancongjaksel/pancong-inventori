/**
 * Ganti password user yang SUDAH ADA (beda dari buat-user-awal.js yang bikin
 * user baru). Dipakai buat ganti password placeholder Owner sebelum dipakai
 * beneran, atau kapan pun perlu reset password manual dari terminal
 * (belum ada endpoint ganti-password di aplikasi — lihat ROADMAP Tahap 2.5).
 *
 * Pemakaian:
 *   node scripts/ganti-password.js --email rinto@pancongjaksel.com --password "password-baru-yang-kuat"
 *
 * Otomatis menaikkan token_versi user itu juga, jadi semua sesi login lama
 * (kalau ada) langsung ke-logout paksa — konsisten sama authService.cabutSemuaSesi.
 */
require('dotenv').config();
const { pool } = require('../db/pool');
const { hashPassword } = require('../utils/passwordHash');

function ambilArg(nama) {
  const idx = process.argv.indexOf(`--${nama}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const email = ambilArg('email');
  const password = ambilArg('password');

  if (!email || !password) {
    console.error('Pemakaian: node scripts/ganti-password.js --email email@x.com --password "password-baru"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password minimal 8 karakter.');
    process.exit(1);
  }
  if (password === 'ganti-ini-password-kuat') {
    console.error('Itu masih password contoh dari README, ganti ke password asli.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET password_hash = $1, token_versi = token_versi + 1
       WHERE email = $2
       RETURNING id, nama, email, role`,
      [passwordHash, email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      console.error(`Gak ketemu user dengan email "${email}".`);
      process.exit(1);
    }

    console.log('Password berhasil diganti untuk:', rows[0]);
    console.log('Semua sesi login lama user ini otomatis ke-logout (token_versi naik).');
  } catch (err) {
    console.error('Gagal ganti password:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
