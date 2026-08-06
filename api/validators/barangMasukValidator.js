const { AppError } = require('../errors/AppError');
const { validasiAksesGudangAdmin } = require('./aksesGudangValidator');

/**
 * Validasi field dasar yang sama untuk input admin maupun crew.
 */
function validasiFieldDasar({ itemId, jumlah, satuan, fotoBuktiUrl }) {
  if (!itemId) throw new AppError('Item wajib dipilih.', 400, 'ITEM_KOSONG');
  if (!(jumlah > 0)) throw new AppError('Jumlah harus lebih dari 0.', 400, 'JUMLAH_TIDAK_VALID');
  if (!satuan || satuan.trim().length === 0) {
    throw new AppError('Satuan wajib diisi.', 400, 'SATUAN_KOSONG');
  }
  if (!fotoBuktiUrl || fotoBuktiUrl.trim().length === 0) {
    // Sesuai keputusan Q4: foto bukti WAJIB untuk barang masuk, tanpa kecuali.
    throw new AppError('Foto bukti nota wajib diunggah.', 400, 'FOTO_BUKTI_WAJIB');
  }
}

/**
 * Validasi input oleh Admin (5.1) — langsung terverifikasi.
 * Admin harus aktif & punya akses ke gudang tujuan input.
 */
async function validasiInputAdmin(client, { userId, gudangId }) {
  await validasiAksesGudangAdmin(client, { userId, gudangId });
}

/**
 * Validasi input oleh Crew (5.1b) — device based, hasilnya "menunggu verifikasi".
 * - device harus aktif dan memang terdaftar di gudang_id yang dipilih
 * - gudang harus bertipe 'serving' (Produksi tidak punya form crew — mirror
 *   trigger trg_validasi_device_bukan_produksi, dicek lagi di sini biar
 *   pesannya rapi di app layer)
 * - nama crew wajib diisi
 */
async function validasiInputCrew(client, { deviceId, gudangId, namaCrewInput }) {
  if (!namaCrewInput || namaCrewInput.trim().length === 0) {
    throw new AppError('Nama crew wajib diisi.', 400, 'NAMA_CREW_KOSONG');
  }

  const { rows } = await client.query(
    `SELECT d.id, d.aktif, d.gudang_id, g.tipe AS tipe_gudang, g.nama AS nama_gudang
     FROM device_gudang d
     JOIN gudang g ON g.id = d.gudang_id
     WHERE d.id = $1`,
    [deviceId]
  );
  const device = rows[0];

  if (!device) {
    throw new AppError(`Device tidak ditemukan (id=${deviceId}).`, 404, 'DEVICE_TIDAK_DITEMUKAN');
  }
  if (!device.aktif) {
    throw new AppError('Device ini sudah tidak aktif, hubungi admin.', 403, 'DEVICE_TIDAK_AKTIF');
  }
  if (device.gudang_id !== gudangId) {
    throw new AppError(
      `Device ini terdaftar di gudang lain, tidak bisa input Barang Masuk untuk gudang_id=${gudangId}.`,
      400,
      'DEVICE_GUDANG_TIDAK_SESUAI'
    );
  }
  if (device.tipe_gudang === 'hub_admin_only') {
    throw new AppError(
      `Gudang "${device.nama_gudang}" adalah hub admin-only — barang masuk di sini hanya bisa diinput Admin.`,
      403,
      'GUDANG_ADMIN_ONLY'
    );
  }
}

/**
 * Validasi sebelum aksi verifikasi (setujui/revisi/tolak) dijalankan admin.
 * - transaksi harus ada dan masih berstatus 'menunggu' (belum diproses admin lain)
 * - admin harus punya akses ke gudang transaksi tsb
 * - aksi 'revisi' wajib sertakan jumlahRevisi baru
 * - aksi 'tolak' wajib sertakan catatan/alasan
 */
async function validasiSebelumVerifikasi(client, { id, aksi, adminUserId, catatan, jumlahRevisi }) {
  const { rows } = await client.query(
    'SELECT id, gudang_id, status_verifikasi FROM transaksi_masuk WHERE id = $1 FOR UPDATE',
    [id]
  );
  const transaksi = rows[0];

  if (!transaksi) {
    throw new AppError(`Transaksi barang masuk tidak ditemukan (id=${id}).`, 404, 'TRANSAKSI_TIDAK_DITEMUKAN');
  }
  if (transaksi.status_verifikasi !== 'menunggu') {
    throw new AppError(
      `Transaksi ini sudah diproses sebelumnya (status: ${transaksi.status_verifikasi}), tidak bisa diverifikasi ulang.`,
      409,
      'TRANSAKSI_SUDAH_DIPROSES'
    );
  }

  await validasiAksesGudangAdmin(client, { userId: adminUserId, gudangId: transaksi.gudang_id });

  if (aksi === 'revisi' && !(jumlahRevisi > 0)) {
    throw new AppError('Jumlah revisi harus diisi dan lebih dari 0.', 400, 'JUMLAH_REVISI_TIDAK_VALID');
  }
  if (aksi === 'tolak' && (!catatan || catatan.trim().length === 0)) {
    throw new AppError('Alasan penolakan wajib diisi.', 400, 'ALASAN_TOLAK_WAJIB');
  }
  if (!['setujui', 'revisi', 'tolak'].includes(aksi)) {
    throw new AppError(`Aksi verifikasi tidak dikenal: "${aksi}".`, 400, 'AKSI_TIDAK_VALID');
  }

  return transaksi; // dipakai lagi di service biar gak query 2x
}

module.exports = {
  validasiFieldDasar,
  validasiInputAdmin,
  validasiInputCrew,
  validasiSebelumVerifikasi,
};
