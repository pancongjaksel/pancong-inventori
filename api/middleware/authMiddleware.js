const { pool } = require('../db/pool');
const { verifikasiToken } = require('../utils/jwt');

function ambilBearerToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.session ?? null;
}

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
        pesan: 'Sesi sudah tidak berlaku, silakan login ulang.',
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
 * Crew session — TIDAK ADA LAGI DB lookup device. QR token (HMAC) sudah
 * jadi kontrol akses saat setup; sesudah itu token JWT ini cukup divalidasi
 * signature-nya doang. `nama` (siapa yang pegang HP) & `gudangId` (gudang
 * mana) datang langsung dari payload token, diisi user sendiri saat submit
 * form nama pertama kali.
 */
async function requireDevice(req, res, next) {
  const token = req.headers['x-device-token'];
  if (!token) {
    return res.status(401).json({
      sukses: false,
      kode: 'SESI_BELUM_DIISI',
      pesan: 'Isi nama kamu dulu lewat scan QR gudang.',
    });
  }

  const payload = verifikasiToken(token);
  if (!payload || payload.tipe !== 'device' || payload.role === 'admin_gudang' || !payload.gudangId) {
    return res.status(401).json({ sukses: false, kode: 'SESI_TIDAK_VALID', pesan: 'Sesi tidak valid, scan ulang QR gudang.' });
  }

  req.device = { id: payload.deviceId, gudangId: payload.gudangId, nama: payload.nama, crewId: payload.crewId, crewSessionId: payload.crewSessionId };
  next();
}

/**
 * Admin Gudang session — sama seperti requireDevice, tanpa DB lookup device.
 * Tapi TETAP butuh req.user.id valid (FK ke tabel users, dipakai di
 * dicatat_oleh_user_id pada stok_opname dkk) — jadi query 1x ke akun
 * bersama "Admin Gudang" yang statis (bukan per-device lagi).
 */
async function requireAdminGudang(req, res, next) {
  const token = req.headers['x-device-token'];
  if (!token) {
    return res.status(401).json({
      sukses: false,
      kode: 'SESI_BELUM_DIISI',
      pesan: 'Isi nama kamu dulu lewat scan QR Admin Gudang.',
    });
  }

  const payload = verifikasiToken(token);
  if (!payload || payload.tipe !== 'device' || payload.role !== 'admin_gudang') {
    return res.status(401).json({ sukses: false, kode: 'SESI_TIDAK_VALID', pesan: 'Sesi tidak valid atau bukan sesi Admin Gudang.' });
  }

  try {
    const { rows: userRows } = await pool.query(
      `SELECT id, role FROM users WHERE role = 'admin_gudang' AND email = 'admin-gudang@pancongjaksel.internal'`
    );
    const user = userRows[0];
    if (!user) {
      return res.status(500).json({ sukses: false, kode: 'USER_NOT_FOUND', pesan: 'User Admin Gudang tidak ditemukan di database.' });
    }

    req.user = { id: user.id, nama: payload.nama, role: user.role };
    req.device = { nama: payload.nama };
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAdminOrGudang(req, res, next) {
  const adaBearer = ambilBearerToken(req);
  const adaDeviceToken = req.headers['x-device-token'];

  if (adaBearer) return requireAdmin(req, res, next);
  if (adaDeviceToken) {
    const payload = verifikasiToken(adaDeviceToken);
    if (payload && payload.tipe === 'device' && payload.role === 'admin_gudang') {
      return requireAdminGudang(req, res, next);
    }
  }

  return res.status(401).json({
    sukses: false,
    kode: 'BELUM_AUTENTIKASI',
    pesan: 'Login sebagai Admin/Owner atau isi nama sesi Admin Gudang dulu.',
  });
}

async function requireAnyAuth(req, res, next) {
  const adaBearer = ambilBearerToken(req);
  const adaDeviceToken = req.headers['x-device-token'];

  if (adaBearer) return requireAdmin(req, res, next);
  if (adaDeviceToken) {
    const payload = verifikasiToken(adaDeviceToken);
    if (payload && payload.tipe === 'device' && payload.role === 'admin_gudang') {
      return requireAdminGudang(req, res, next);
    }
    return requireDevice(req, res, next);
  }

  return res.status(401).json({
    sukses: false,
    kode: 'BELUM_AUTENTIKASI',
    pesan: 'Login dulu sebelum mengakses ini.',
  });
}

module.exports = { requireAdmin, requireDevice, requireAdminGudang, requireAdminOrGudang, requireAnyAuth };
