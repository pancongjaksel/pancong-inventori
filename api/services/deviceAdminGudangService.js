const { AppError } = require('../errors/AppError');
const { buatTokenQrAdminGudang, verifikasiTokenQrAdminGudang } = require('../utils/deviceQrToken');
const { buatTokenDevice } = require('../utils/jwt');

async function generateQrAdminGudang() {
  const token = buatTokenQrAdminGudang();
  return {
    token,
    qrContent: `${process.env.APP_BASE_URL || 'https://app.pancongjaksel.com'}/setup-device?type=admin-gudang&token=${token}`,
  };
}

/**
 * Mulai sesi Admin Gudang dari hasil scan QR. Sama seperti mulaiSesiGudang,
 * tanpa DB insert. Role 'admin_gudang' dibakar ke token, dibaca middleware
 * requireAdminGudang buat routing akses (opname, verifikasi, transfer).
 */
async function mulaiSesiAdminGudang({ token, nama }) {
  const tokenValid = verifikasiTokenQrAdminGudang(token);
  if (!tokenValid) {
    throw new AppError('QR tidak valid atau rusak. Pastikan scan QR asli yang ditempel.', 400, 'QR_TIDAK_VALID');
  }
  if (!nama || nama.trim().length === 0) {
    throw new AppError('Nama wajib diisi.', 400, 'NAMA_KOSONG');
  }

  const deviceToken = buatTokenDevice({ role: 'admin_gudang', nama: nama.trim() });
  return { nama: nama.trim(), deviceToken };
}

module.exports = { generateQrAdminGudang, mulaiSesiAdminGudang };
