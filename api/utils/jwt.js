const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn(
    '[jwt] PERINGATAN: JWT_SECRET belum di-set di environment. ' +
      'Token auth TIDAK aman dipakai sampai ini diisi.'
  );
}

const USER_TOKEN_EXPIRY = '8h';
// Token sesi crew/admin-gudang — umur PANJANG, gak ada lagi row device di
// database buat divalidasi ulang (redesign: QR = akses, nama diisi user
// sendiri tiap butuh, tersimpan di localStorage HP-nya). Revoke akses cuma
// bisa total lewat rotate DEVICE_QR_SECRET, bukan per-device lagi.
const DEVICE_TOKEN_EXPIRY = '3650d'; // ~10 tahun

function buatTokenUser({ userId, role, tokenVersi }) {
  return jwt.sign({ tipe: 'user', userId, role, tokenVersi }, JWT_SECRET, {
    expiresIn: USER_TOKEN_EXPIRY,
  });
}

/**
 * Token sesi crew/admin-gudang. TIDAK ada lagi deviceId/tokenVersi — token
 * ini gak divalidasi ulang ke database sama sekali, cukup signature JWT.
 * `nama` = nama orang yang diisi manual (bukan device), `role` = 'admin_gudang'
 * atau undefined (crew biasa), `gudangId` cuma relevan buat crew.
 */
function buatTokenDevice({ gudangId, role, nama, crewId, crewSessionId }) {
  return jwt.sign({ tipe: 'device', gudangId: gudangId ?? null, role: role ?? null, nama, crewId: crewId ?? null, crewSessionId: crewSessionId ?? null }, JWT_SECRET, {
    expiresIn: DEVICE_TOKEN_EXPIRY,
  });
}

function verifikasiToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = { buatTokenUser, buatTokenDevice, verifikasiToken };
