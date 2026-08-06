const express = require('express');
const { requireAdmin } = require('../middleware/authMiddleware');
const { koreksiTransaksi } = require('../services/koreksiTransaksiService');

const router = express.Router();

/**
 * POST /api/koreksi-transaksi (admin)
 * Body: { tabelTransaksi, transaksiAsalId, alasan }
 */
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await koreksiTransaksi({ ...req.body, olehUserId: req.user.id });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
