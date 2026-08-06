const express = require('express');
const { requireAdmin } = require('../middleware/authMiddleware');
const { buatOpnameGudang, buatOpnameOutlet } = require('../services/stokOpnameService');
const { generateRekapForecast, generateRekapForecastExcel } = require('../services/rekapForecastService');

const router = express.Router();

/** POST /api/stok-opname/gudang (admin) */
router.post('/gudang', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await buatOpnameGudang({ ...req.body, userId: req.user.id });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** POST /api/stok-opname/outlet (admin) */
router.post('/outlet', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await buatOpnameOutlet({ ...req.body, userId: req.user.id });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stok-opname/rekap?periode=2026-08 (admin/owner — laporan)
 */
router.get('/rekap', requireAdmin, async (req, res, next) => {
  try {
    const { periode } = req.query;
    if (!periode) {
      return res.status(400).json({ sukses: false, kode: 'PERIODE_WAJIB', pesan: 'Query param "periode" wajib diisi, format YYYY-MM.' });
    }
    const hasil = await generateRekapForecast(periode);
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stok-opname/rekap/export?periode=2026-08 (admin/owner)
 * Balikin file .xlsx beneran (bukan JSON) — Content-Disposition attachment,
 * langsung ke-download browser.
 */
router.get('/rekap/export', requireAdmin, async (req, res, next) => {
  try {
    const { periode } = req.query;
    if (!periode) {
      return res.status(400).json({ sukses: false, kode: 'PERIODE_WAJIB', pesan: 'Query param "periode" wajib diisi, format YYYY-MM.' });
    }

    const workbook = await generateRekapForecastExcel(periode);
    const namaFile = `Rekap-Opname-Forecast-${periode}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
