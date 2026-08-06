const { AppError } = require('../errors/AppError');

/** Semua aksi kelola user (buat, ubah, reset password, kasih akses gudang) khusus Owner. */
function validasiPelakuOwner(pelaku) {
  if (pelaku.role !== 'owner') {
    throw new AppError('Cuma Owner yang boleh mengelola akun Admin/Owner lain.', 403, 'AKSES_DITOLAK_BUKAN_OWNER');
  }
}

function validasiBuatUser({ nama, email, password, role }) {
  if (!nama || !email || !password || !role) {
    throw new AppError('Nama, email, password, dan role wajib diisi.', 400, 'FIELD_KOSONG');
  }
  if (role !== 'owner' && role !== 'admin') {
    throw new AppError(`Role harus 'owner' atau 'admin', dapat '${role}'.`, 400, 'ROLE_TIDAK_VALID');
  }
  if (password.length < 8) {
    throw new AppError('Password minimal 8 karakter.', 400, 'PASSWORD_TERLALU_PENDEK');
  }
}

module.exports = { validasiPelakuOwner, validasiBuatUser };
