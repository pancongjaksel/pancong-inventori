const { pool } = require('../db/pool');
const { AppError } = require('../errors/AppError');
const { hashPassword } = require('../utils/passwordHash');
const { validasiPelakuOwner, validasiBuatUser } = require('../validators/userManajemenValidator');

async function listUsers() {
  const { rows } = await pool.query(`
    SELECT u.id, u.nama, u.email, u.role, u.aktif, u.created_at,
           COALESCE(json_agg(g.nama) FILTER (WHERE g.nama IS NOT NULL), '[]') AS akses_gudang
    FROM users u
    LEFT JOIN user_akses_gudang uag ON uag.user_id = u.id
    LEFT JOIN gudang g ON g.id = uag.gudang_id
    GROUP BY u.id
    ORDER BY u.role, u.nama
  `);
  return rows;
}

async function buatUser(input, pelaku) {
  validasiPelakuOwner(pelaku);
  validasiBuatUser(input);
  const { nama, email, password, role } = input;

  const passwordHash = await hashPassword(password);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (nama, email, password_hash, role) VALUES ($1, $2, $3, $4)
       RETURNING id, nama, email, role, aktif`,
      [nama.trim(), email.toLowerCase().trim(), passwordHash, role]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError(`Email "${email}" sudah terdaftar.`, 409, 'EMAIL_DUPLIKAT');
    }
    throw err;
  }
}

async function updateUser(id, fields, pelaku) {
  validasiPelakuOwner(pelaku);
  const { nama, aktif, role } = fields;
  if (nama === undefined && aktif === undefined && role === undefined) {
    throw new AppError('Gak ada field yang diubah.', 400, 'TIDAK_ADA_PERUBAHAN');
  }
  if (Number(id) === pelaku.id && aktif === false) {
    throw new AppError('Gak bisa nonaktifkan akun sendiri.', 400, 'TIDAK_BISA_NONAKTIFKAN_DIRI_SENDIRI');
  }

  const setClauses = [];
  const values = [];
  let i = 1;
  if (nama !== undefined) { setClauses.push(`nama = $${i}`); values.push(nama.trim()); i += 1; }
  if (aktif !== undefined) { setClauses.push(`aktif = $${i}`); values.push(aktif); i += 1; }
  if (role !== undefined) { setClauses.push(`role = $${i}`); values.push(role); i += 1; }
  // Nonaktifin atau ganti role = paksa logout semua sesi user itu (naikkan token_versi)
  if (aktif === false || role !== undefined) {
    setClauses.push(`token_versi = token_versi + 1`);
  }
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING id, nama, email, role, aktif`,
    values
  );
  if (rows.length === 0) {
    throw new AppError(`User tidak ditemukan (id=${id}).`, 404, 'USER_TIDAK_DITEMUKAN');
  }
  return rows[0];
}

async function resetPasswordUser(id, passwordBaru, pelaku) {
  validasiPelakuOwner(pelaku);
  if (!passwordBaru || passwordBaru.length < 8) {
    throw new AppError('Password baru minimal 8 karakter.', 400, 'PASSWORD_TERLALU_PENDEK');
  }
  const passwordHash = await hashPassword(passwordBaru);
  const { rows } = await pool.query(
    `UPDATE users SET password_hash = $1, token_versi = token_versi + 1 WHERE id = $2 RETURNING id, nama, email`,
    [passwordHash, id]
  );
  if (rows.length === 0) {
    throw new AppError(`User tidak ditemukan (id=${id}).`, 404, 'USER_TIDAK_DITEMUKAN');
  }
  return rows[0];
}

async function tambahAksesGudang(userId, gudangId, pelaku) {
  validasiPelakuOwner(pelaku);
  try {
    await pool.query(
      `INSERT INTO user_akses_gudang (user_id, gudang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, gudangId]
    );
    return { userId, gudangId, ditambahkan: true };
  } catch (err) {
    if (err.code === '23503') {
      throw new AppError('User atau gudang tidak ditemukan.', 404, 'DATA_TIDAK_DITEMUKAN');
    }
    throw err;
  }
}

async function hapusAksesGudang(userId, gudangId, pelaku) {
  validasiPelakuOwner(pelaku);
  await pool.query(`DELETE FROM user_akses_gudang WHERE user_id = $1 AND gudang_id = $2`, [userId, gudangId]);
  return { userId, gudangId, dihapus: true };
}

module.exports = { listUsers, buatUser, updateUser, resetPasswordUser, tambahAksesGudang, hapusAksesGudang };
