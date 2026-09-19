const { pool } = require('../db/pool');
const { AppError } = require('../errors/AppError');
const { verifikasiPassword } = require('../utils/passwordHash');
const { buatTokenUser } = require('../utils/jwt');

async function login({ email, password }) {
  if (!email || !password) {
    throw new AppError('Email dan password wajib diisi.', 400, 'FIELD_KOSONG');
  }

  const { rows } = await pool.query(
    'SELECT id, nama, email, password_hash, role, aktif, token_versi FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );
  const user = rows[0];

  // Admin Gudang cuma boleh login lewat device QR, gak lewat email+password
  // (lihat migration add-device-admin-gudang — password_hash-nya emang
  // sengaja gak bisa dipakai buat login).
  if (user && user.role === 'admin_gudang') {
    throw new AppError(
      'User Admin Gudang hanya bisa login via device QR, bukan email+password. Setup device terlebih dahulu.',
      403,
      'ADMIN_GUDANG_QR_ONLY'
    );
  }

  // Pesan generik SENGAJA sama antara "email gak ada" dan "password salah"
  // — supaya orang gak bisa nebak-nebak email mana yang terdaftar (user
  // enumeration).
  const pesanGagal = 'Email atau password salah.';

  if (!user) {
    throw new AppError(pesanGagal, 401, 'LOGIN_GAGAL');
  }
  if (!user.aktif) {
    throw new AppError('Akun ini sudah dinonaktifkan, hubungi Owner.', 403, 'AKUN_TIDAK_AKTIF');
  }

  const passwordCocok = await verifikasiPassword(password, user.password_hash);
  if (!passwordCocok) {
    throw new AppError(pesanGagal, 401, 'LOGIN_GAGAL');
  }

  const token = buatTokenUser({ userId: user.id, role: user.role, tokenVersi: user.token_versi });

  return {
    token,
    user: { id: user.id, nama: user.nama, email: user.email, role: user.role },
  };
}

/**
 * Paksa logout semua sesi user ini (dipanggil setelah ganti password,
 * atau kalau Owner mau cabut akses admin tertentu tanpa nonaktifkan akunnya).
 */
async function cabutSemuaSesi(userId) {
  await pool.query('UPDATE users SET token_versi = token_versi + 1 WHERE id = $1', [userId]);
}

module.exports = { login, cabutSemuaSesi };
