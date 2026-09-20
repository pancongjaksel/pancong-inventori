const express = require('express');
const { login, cabutSemuaSesi } = require('../services/authService');
const { requireAdmin } = require('../middleware/authMiddleware');
const { batasiLogin } = require('../middleware/rateLimiters');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 8 * 60 * 60 * 1000, // 8 jam, samain sama umur token (lihat utils/jwt.js)
};

/**
 * POST /api/auth/login — Body: { email, password }
 * Token dikirim 2 cara sekaligus: di response body (buat client yang nyimpen
 * manual, mis. mobile app) DAN sebagai cookie httpOnly 'session' (buat
 * browser admin panel, lebih aman dari XSS karena JS gak bisa baca cookie
 * httpOnly). Middleware requireAdmin nerima keduanya.
 */
router.post('/login', batasiLogin, async (req, res, next) => {
  try {
    const hasil = await login(req.body);
    res.cookie('session', hasil.token, COOKIE_OPTIONS);
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** POST /api/auth/logout — hapus cookie sesi di browser ini saja */
router.post('/logout', (req, res) => {
  res.clearCookie('session', COOKIE_OPTIONS);
  res.status(200).json({ sukses: true, data: { pesan: 'Logout berhasil.' } });
});

/**
 * POST /api/auth/logout-semua-sesi
 * Paksa logout SEMUA device/browser yang lagi login sebagai user ini
 * (naikkan token_versi). Request ini sendiri juga ikut ke-invalidate setelah
 * dijalankan — itu memang tujuannya.
 */
router.post('/logout-semua-sesi', requireAdmin, async (req, res, next) => {
  try {
    await cabutSemuaSesi(req.user.id);
    res.clearCookie('session', COOKIE_OPTIONS);
    res.status(200).json({ sukses: true, data: { pesan: 'Semua sesi berhasil di-logout.' } });
  } catch (err) {
    next(err);
  }
});

/** GET /api/auth/me — cek status login saat ini (dipanggil frontend pas app dibuka) */
router.get('/me', requireAdmin, async (req, res) => {
  res.status(200).json({ sukses: true, data: { user: req.user } });
});

module.exports = router;
