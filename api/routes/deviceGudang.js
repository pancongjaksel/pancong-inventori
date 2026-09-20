const express = require('express');
const { requireAdmin } = require('../middleware/authMiddleware');
const { generateQrGudang, mulaiSesiGudang } = require('../services/deviceGudangService');
const { batasiSetupDevice } = require('../middleware/rateLimiters');

const router = express.Router();

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
 * POST /api/device-gudang/setup — mulai sesi crew dari hasil scan QR.
 * Body: { token, nama }. TIDAK butuh admin login (QR = kontrol akses).
 */
router.post('/setup', batasiSetupDevice, async (req, res, next) => {
  try {
    const hasil = await mulaiSesiGudang(req.body);
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
