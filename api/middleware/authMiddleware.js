const { pool } = require('../db/pool');
const { verifikasiToken } = require('../utils/jwt');

function ambilBearerToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  // Fallback ke cookie httpOnly 'session' (di-set saat login, lihat
  // routes/auth.js) — memudahkan pemakaian dari browser admin panel tanpa
  // frontend harus nyimpen token manual di JS-accessible storage.
  return req.cookies?.session ?? null;
}

/**
 * Middleware buat route Admin/Owner. Verifikasi JWT, lalu CROSS-CHECK ke
 * database (aktif=true & token_versi cocok) — bukan cuma percaya isi token,
 * karena JWT gak otomatis tau kalau user dinonaktifkan atau diminta logout
 * paksa (ganti password dll) setelah token itu diterbitkan.
 *
 * Sukses -> req.user = { id, nama, role }
 */
async function requireAdmin(req, res, next) {
  const token = ambilBearerToken(req);
  if (!token) {
    return res.status(401).json({ sukses: false, kode: 'BELUM_LOGIN', pesan: 'Silakan login terlebih dahulu.' });
  }

  const payload = verifikasiToken(token);
  if (!payload || payload.tipe !== 'user') {
    return res.status(401).json({ sukses: false, kode: 'SESSION_TIDAK_VALID', pesan: 'Sesi tidak valid, silakan login ulang.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, nama, role, aktif, token_versi FROM users WHERE id = $1',
      [payload.userId]
    );
    const user = rows[0];

    if (!user || !user.aktif || user.token_versi !== payload.tokenVersi) {
      return res.status(401).json({
        sukses: false,
        kode: 'SESI_KADALUARSA',
        pesan: 'Sesi sudah tidak berlaku (mis. password diganti atau akun dinonaktifkan), silakan login ulang.',
      });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return res.status(403).json({ sukses: false, kode: 'AKSES_DITOLAK', pesan: 'Akun ini bukan admin/owner.' });
    }

    req.user = { id: user.id, nama: user.nama, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware buat route Crew (device-based, bukan login personal). Token
 * dari header `X-Device-Token` (disimpan browser device di localStorage
 * setelah setup QR — lihat deviceGudangService.setupDeviceDariQr).
 *
 * Sukses -> req.device = { id, gudangId }
 */
async function requireDevice(req, res, next) {
  const token = req.headers['x-device-token'];
  if (!token) {
    return res.status(401).json({
      sukses: false,
      kode: 'DEVICE_BELUM_SETUP',
      pesan: 'Device ini belum di-setup. Minta admin scan QR gudang di device ini dulu.',
    });
  }

  const payload = verifikasiToken(token);
  if (!payload || payload.tipe !== 'device') {
    return res.status(401).json({ sukses: false, kode: 'DEVICE_TOKEN_TIDAK_VALID', pesan: 'Token device tidak valid, setup ulang lewat scan QR.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, gudang_id, aktif, token_versi FROM device_gudang WHERE id = $1',
      [payload.deviceId]
    );
    const device = rows[0];

    if (!device || !device.aktif || device.token_versi !== payload.tokenVersi) {
      return res.status(403).json({
        sukses: false,
        kode: 'DEVICE_TIDAK_AKTIF',
        pesan: 'Device ini sudah dicabut aksesnya oleh admin (mis. HP hilang), minta setup ulang.',
      });
    }

    req.device = { id: device.id, gudangId: device.gudang_id };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware buat endpoint BACA yang boleh diakses admin ATAU device
 * (mis. daftar item, daftar outlet — informasinya sendiri gak sensitif,
 * yang penting device/user-nya valid). Coba admin dulu, kalau gak ada
 * Bearer token/cookie, coba device. Gagal dua-duanya -> 401.
 *
 * Sukses -> req.user ATAU req.device keisi (salah satu), gak dua-duanya.
 */
async function requireAnyAuth(req, res, next) {
  const adaBearer = ambilBearerToken(req);
  const adaDeviceToken = req.headers['x-device-token'];

  if (adaBearer) return requireAdmin(req, res, next);
  if (adaDeviceToken) return requireDevice(req, res, next);

  return res.status(401).json({
    sukses: false,
    kode: 'BELUM_AUTENTIKASI',
    pesan: 'Login (Admin) atau setup device (Crew) dulu sebelum mengakses ini.',
  });
}

module.exports = { requireAdmin, requireDevice, requireAnyAuth };
