const { pool } = require('../db/pool');
const { AppError } = require('../errors/AppError');
const { buatTokenQrGudang, verifikasiTokenQrGudang } = require('../utils/deviceQrToken');
const { buatTokenDevice } = require('../utils/jwt');
const { validasiGenerateQr, validasiSetupDevice } = require('../validators/deviceGudangValidator');

/**
 * Generate konten QR untuk 1 gudang (dipanggil Admin, sekali per gudang,
 * hasilnya dicetak & ditempel fisik di lokasi). Token TIDAK expired — QR
 * ini nempel permanen selama gudang itu masih beroperasi.
 */
async function generateQrGudang({ gudangId, adminUserId }) {
  const client = await pool.connect();
  try {
    const gudang = await validasiGenerateQr(client, { gudangId, adminUserId });
    const token = buatTokenQrGudang(gudangId);
    return {
      gudangId,
      namaGudang: gudang.nama,
      token,
      // Frontend tinggal encode string ini jadi QR image (mis. pakai
      // library `qrcode`). Isinya URL deep-link ke halaman setup device,
      // supaya scan QR pakai kamera HP langsung buka app di halaman yang
      // benar (bukan cuma teks token mentah).
      qrContent: `${process.env.APP_BASE_URL || 'https://app.pancongjaksel.com'}/setup-device?token=${token}`,
    };
  } finally {
    client.release();
  }
}

/**
 * Setup device baru dari hasil scan QR. Dipanggil dari halaman "Setup
 * Device" yang WAJIB diakses dalam kondisi Admin sudah login (autentikasi
 * dicek di middleware, adminUserId dari situ — bukan dari body request).
 */
async function setupDeviceDariQr({ token, namaDevice, adminUserId }) {
  const gudangId = verifikasiTokenQrGudang(token);
  if (gudangId === null) {
    throw new AppError(
      'QR tidak valid atau rusak. Pastikan scan QR asli yang ditempel di gudang, ' +
        'bukan hasil screenshot/foto ulang yang mungkin ke-crop.',
      400,
      'QR_TIDAK_VALID'
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gudang = await validasiSetupDevice(client, { gudangId, namaDevice, adminUserId });

    const { rows } = await client.query(
      `INSERT INTO device_gudang (nama_device, gudang_id) VALUES ($1, $2) RETURNING id`,
      [namaDevice.trim(), gudangId]
    );

    await client.query('COMMIT');
    const deviceId = rows[0].id;
    const deviceToken = buatTokenDevice({ deviceId, gudangId, tokenVersi: 1 }); // token_versi default 1 (lihat migration add-token-versi)
    // Frontend simpan `deviceToken` ini di localStorage browser device tsb,
    // dikirim lewat header X-Device-Token di tiap request Crew berikutnya
    // (dibaca oleh middleware requireDevice).
    return { deviceId, gudangId, namaGudang: gudang.nama, deviceToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Daftar semua device (Admin), buat halaman kelola device. */
async function listDevices() {
  const { rows } = await pool.query(`
    SELECT dg.id, dg.nama_device, dg.aktif, dg.created_at, g.nama AS nama_gudang
    FROM device_gudang dg
    JOIN gudang g ON g.id = dg.gudang_id
    ORDER BY g.nama, dg.nama_device
  `);
  return rows;
}

/**
 * Cabut akses device (mis. HP hilang) — set aktif=false DAN naikkan
 * token_versi (dua-duanya, biar aman: token lama pasti ketolak middleware
 * requireDevice walau salah satu pengecekan somehow ke-skip).
 */
async function cabutAksesDevice(id) {
  const { rows } = await pool.query(
    `UPDATE device_gudang SET aktif = false, token_versi = token_versi + 1 WHERE id = $1 RETURNING id, nama_device`,
    [id]
  );
  if (rows.length === 0) {
    throw new AppError(`Device tidak ditemukan (id=${id}).`, 404, 'DEVICE_TIDAK_DITEMUKAN');
  }
  return rows[0];
}

/** Aktifkan lagi device yang sebelumnya dicabut (kalau HP-nya ketemu lagi, misalnya). */
async function aktifkanKembaliDevice(id) {
  const { rows } = await pool.query(
    `UPDATE device_gudang SET aktif = true WHERE id = $1 RETURNING id, nama_device`,
    [id]
  );
  if (rows.length === 0) {
    throw new AppError(`Device tidak ditemukan (id=${id}).`, 404, 'DEVICE_TIDAK_DITEMUKAN');
  }
  return rows[0];
}

module.exports = { generateQrGudang, setupDeviceDariQr, listDevices, cabutAksesDevice, aktifkanKembaliDevice };
