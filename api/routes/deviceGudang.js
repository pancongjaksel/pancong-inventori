const express = require('express');
const { requireAdmin, requireDevice } = require('../middleware/authMiddleware');
const { pool } = require('../db/pool');
const {
  generateQrGudang,
  setupDeviceDariQr,
  listDevices,
  cabutAksesDevice,
  aktifkanKembaliDevice,
} = require('../services/deviceGudangService');

const router = express.Router();

/** GET /api/device-gudang — daftar semua device (admin) */
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await listDevices();
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** GET /api/device-gudang/qr/:gudangId — generate konten QR (admin) */
router.get('/qr/:gudangId', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await generateQrGudang({
      gudangId: Number(req.params.gudangId),
      adminUserId: req.user.id,
    });
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/device-gudang/setup (admin — login dulu, baru scan QR di lokasi)
 * Body: { token, namaDevice }
 * Response.data.deviceToken -> disimpan browser device itu di localStorage,
 * dipakai di header X-Device-Token buat semua request Crew berikutnya.
 */
router.post('/setup', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await setupDeviceDariQr({ ...req.body, adminUserId: req.user.id });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/device-gudang/me — cek status setup device ini (dipanggil frontend
 * Crew pas app dibuka, buat tau device ini udah pernah di-setup & gudang mana)
 */
router.get('/me', requireDevice, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT nama FROM gudang WHERE id = $1', [req.device.gudangId]);
    res.status(200).json({
      sukses: true,
      data: { deviceId: req.device.id, gudangId: req.device.gudangId, namaGudang: rows[0]?.nama },
    });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/device-gudang/:id/cabut — cabut akses device (mis. HP hilang), admin */
router.patch('/:id/cabut', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await cabutAksesDevice(Number(req.params.id));
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/device-gudang/:id/aktifkan — aktifkan lagi device yang dicabut, admin */
router.patch('/:id/aktifkan', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await aktifkanKembaliDevice(Number(req.params.id));
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
