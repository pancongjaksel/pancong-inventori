const { AppError } = require('../errors/AppError');
const { validasiAksesGudangAdmin } = require('./aksesGudangValidator');

/** Validasi sebelum generate QR — admin harus punya akses ke gudang itu. */
async function validasiGenerateQr(client, { gudangId, adminUserId }) {
  const { rows } = await client.query('SELECT id, nama, tipe FROM gudang WHERE id = $1', [gudangId]);
  const gudang = rows[0];
  if (!gudang) {
    throw new AppError(`Gudang tidak ditemukan (id=${gudangId}).`, 404, 'GUDANG_TIDAK_DITEMUKAN');
  }
  if (gudang.tipe === 'hub_admin_only') {
    throw new AppError(
      `Gudang "${gudang.nama}" adalah hub admin-only, tidak butuh QR device (tidak ada form crew di sana).`,
      400,
      'GUDANG_TIDAK_BUTUH_QR'
    );
  }
  await validasiAksesGudangAdmin(client, { userId: adminUserId, gudangId });
  return gudang;
}

/**
 * Validasi sebelum setup device baru dari hasil scan QR.
 * `gudangId` di sini udah hasil verifikasi token (dari deviceQrToken.js),
 * jadi dianggap terpercaya — tinggal cek gudang-nya masih valid & admin
 * yang scan emang punya akses ke situ.
 */
async function validasiSetupDevice(client, { gudangId, namaDevice, adminUserId }) {
  if (!namaDevice || namaDevice.trim().length === 0) {
    throw new AppError('Nama device wajib diisi (mis. "HP Kasir UGM 1").', 400, 'NAMA_DEVICE_KOSONG');
  }

  const { rows } = await client.query('SELECT id, nama, tipe, max_device_quota FROM gudang WHERE id = $1', [gudangId]);
  const gudang = rows[0];
  if (!gudang) {
    throw new AppError('QR tidak valid — gudang tidak ditemukan.', 400, 'QR_TIDAK_VALID');
  }
  if (gudang.tipe === 'hub_admin_only') {
    // Jaga-jaga kalau somehow ada QR utk Gudang Produksi ke-generate (harusnya
    // udah dicegah di validasiGenerateQr, ini lapis kedua).
    throw new AppError(
      `Gudang "${gudang.nama}" tidak bisa punya device crew.`,
      400,
      'GUDANG_ADMIN_ONLY'
    );
  }

  const { rows: countRows } = await client.query(
    `SELECT count(*)::int AS jumlah FROM device_gudang WHERE gudang_id = $1 AND aktif = true`,
    [gudangId]
  );
  const jumlahSaatIni = countRows[0].jumlah;
  if (jumlahSaatIni >= gudang.max_device_quota) {
    throw new AppError(
      `Kuota device gudang "${gudang.nama}" sudah penuh (${jumlahSaatIni}/${gudang.max_device_quota}). Hubungi admin buat tambahin kuota.`,
      409,
      'KUOTA_DEVICE_PENUH'
    );
  }

  await validasiAksesGudangAdmin(client, { userId: adminUserId, gudangId });
  return gudang;
}

module.exports = { validasiGenerateQr, validasiSetupDevice };
