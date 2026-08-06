/**
 * Bikin user Admin/Owner pertama, dijalankan manual dari terminal (BUKAN
 * lewat API, karena belum ada endpoint buat-user & memang belum ada siapa
 * pun yang login buat manggil endpoint semacam itu — chicken-and-egg).
 *
 * Pemakaian:
 *   node scripts/buat-user-awal.js --nama "Rinto" --email rinto@pancongjaksel.com --password "ganti-ini" --role owner
 *
 * Semua 4 flag wajib. Role harus 'owner' atau 'admin'.
 */
require('dotenv').config();
const { pool } = require('../db/pool');
const { hashPassword } = require('../utils/passwordHash');

function ambilArg(nama) {
  const idx = process.argv.indexOf(`--${nama}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const nama = ambilArg('nama');
  const email = ambilArg('email');
  const password = ambilArg('password');
  const role = ambilArg('role');

  if (!nama || !email || !password || !role) {
    console.error(
      'Pemakaian: node scripts/buat-user-awal.js --nama "Nama" --email email@x.com --password "xxx" --role owner|admin'
    );
    process.exit(1);
  }
  if (role !== 'owner' && role !== 'admin') {
    console.error(`Role harus 'owner' atau 'admin', dapat: '${role}'`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password minimal 8 karakter.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (nama, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nama, email, role`,
      [nama, email.toLowerCase().trim(), passwordHash, role]
    );
    console.log('User berhasil dibuat:', rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      console.error(`Email "${email}" sudah terdaftar.`);
    } else {
      console.error('Gagal bikin user:', err.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
