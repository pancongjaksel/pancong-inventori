const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn(
    '[jwt] PERINGATAN: JWT_SECRET belum di-set di environment. ' +
      'Token auth TIDAK aman dipakai sampai ini diisi.'
  );
}

// Token sesi Admin/Owner — umur pendek (8 jam), harus login ulang tiap hari kerja.
const USER_TOKEN_EXPIRY = '8h';

// Token Device — umur PANJANG (dianggap "dipasangkan" permanen sampai admin
// cabut manual lewat token_versi, bukan lewat expiry alami), karena device
// ini nempel fisik di gudang dan gak realistis suruh Admin login ulang tiap
// beberapa jam di HP yang dipakai gantian crew.
const DEVICE_TOKEN_EXPIRY = '3650d'; // ~10 tahun

function buatTokenUser({ userId, role, tokenVersi }) {
  return jwt.sign({ tipe: 'user', userId, role, tokenVersi }, JWT_SECRET, {
    expiresIn: USER_TOKEN_EXPIRY,
  });
}

function buatTokenDevice({ deviceId, gudangId, tokenVersi }) {
  return jwt.sign({ tipe: 'device', deviceId, gudangId, tokenVersi }, JWT_SECRET, {
    expiresIn: DEVICE_TOKEN_EXPIRY,
  });
}

/** Return payload decoded kalau valid, atau null kalau invalid/expired. */
function verifikasiToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = { buatTokenUser, buatTokenDevice, verifikasiToken };
