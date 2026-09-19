const { AppError } = require('../errors/AppError');

/**
 * Validasi: user adalah admin/owner/admin_gudang yang aktif, dan (khusus
 * role='admin') punya akses ke gudang_id tertentu lewat tabel
 * user_akses_gudang. Owner & Admin Gudang dianggap punya akses semua gudang
 * (gak perlu baris di user_akses_gudang — Admin Gudang emang gak gudang-scoped
 * sama sekali).
 *
 * Dipakai di modul Barang Masuk (lama & nota), Koreksi Transaksi, Transfer
 * Gudang (kirim/terima), dan Stok Opname Gudang.
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

  if (user.role === 'owner') return; // owner akses semua gudang

  if (user.role === 'admin_gudang') {
    // Bukan gudang-scoped (sesi admin_gudang gak punya gudangId di token sama
    // sekali — 1 akun shared buat semua gudang, dipilih dari UI tiap aksi).
    // TIDAK LAGI query device_admin_gudang: sejak redesign auth, sesi device
    // divalidasi cukup lewat signature JWT (requireAdminGudang), gak ada lagi
    // baris device per-sesi yang perlu dicek statusnya di sini — tabel
    // device_admin_gudang jadi arsip historis, sama seperti device_gudang.
    // Yang masih perlu dijaga di sini cuma: gudangId yang dikirim itu beneran
    // ID gudang yang valid, bukan ID ngasal/typo dari client.
    const { rows: gudangRows } = await client.query('SELECT id FROM gudang WHERE id = $1', [gudangId]);
    if (gudangRows.length === 0) {
      throw new AppError(`Gudang tidak ditemukan (id=${gudangId}).`, 404, 'GUDANG_TIDAK_DITEMUKAN');
    }
    return;
  }

  if (user.role !== 'admin') {
    throw new AppError(
      `User "${user.nama}" bukan admin/owner/admin_gudang, tidak punya akses untuk aksi ini.`,
      403,
      'AKSES_DITOLAK'
    );
  }

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
