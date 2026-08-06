const { AppError } = require('../errors/AppError');

/**
 * Validasi: user adalah admin/owner yang aktif, dan (khusus role='admin')
 * punya akses ke gudang_id tertentu lewat tabel user_akses_gudang.
 * Owner dianggap punya akses semua gudang (tidak perlu baris di user_akses_gudang).
 *
 * Dipakai di modul Barang Masuk (verifikasi) dan Transfer Gudang (kirim/terima),
 * karena keduanya "admin only" sesuai PRD Bagian 4.
 */
async function validasiAksesGudangAdmin(client, { userId, gudangId }) {
  const { rows } = await client.query(
    'SELECT id, nama, role, aktif FROM users WHERE id = $1',
    [userId]
  );
  const user = rows[0];

  if (!user) {
    throw new AppError(`User tidak ditemukan (id=${userId}).`, 404, 'USER_TIDAK_DITEMUKAN');
  }
  if (!user.aktif) {
    throw new AppError(`User "${user.nama}" sudah tidak aktif.`, 403, 'USER_TIDAK_AKTIF');
  }
  if (user.role !== 'admin' && user.role !== 'owner') {
    throw new AppError(
      `User "${user.nama}" bukan admin/owner, tidak punya akses untuk aksi ini.`,
      403,
      'AKSES_DITOLAK'
    );
  }

  if (user.role === 'owner') return; // owner akses semua gudang

  const { rows: aksesRows } = await client.query(
    'SELECT 1 FROM user_akses_gudang WHERE user_id = $1 AND gudang_id = $2',
    [userId, gudangId]
  );
  if (aksesRows.length === 0) {
    const { rows: gudangRows } = await client.query('SELECT nama FROM gudang WHERE id = $1', [
      gudangId,
    ]);
    const namaGudang = gudangRows[0]?.nama ?? `id=${gudangId}`;
    throw new AppError(
      `User "${user.nama}" tidak punya akses ke Gudang ${namaGudang}.`,
      403,
      'AKSES_GUDANG_DITOLAK'
    );
  }
}

module.exports = { validasiAksesGudangAdmin };
