const express = require('express');
const { requireAdmin } = require('../middleware/authMiddleware');
const { generateQrAdminGudang, mulaiSesiAdminGudang } = require('../services/deviceAdminGudangService');
const { batasiSetupDevice } = require('../middleware/rateLimiters');

const router = express.Router();

router.get('/qr', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await generateQrAdminGudang();
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

router.post('/setup', batasiSetupDevice, async (req, res, next) => {
  try {
    const hasil = await mulaiSesiAdminGudang(req.body);
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
