const express = require('express');
const { pool } = require('../db/pool');
const { requireAnyAuth, requireAdmin } = require('../middleware/authMiddleware');
const { buatItem, updateItem } = require('../services/itemService');
const { buatOutlet, updateOutlet } = require('../services/outletService');
const { listReorderPoints, setReorderPoint } = require('../services/itemReorderPointService');

const router = express.Router();

/**
 * GET /api/master/outlets
 * Device (Crew) -> otomatis difilter ke outlet yang dilayani gudang device itu
 *   (mis. device di Gudang UGM cuma dapet {UGM, Pogung, Kaliurang}).
 * Admin -> dapet semua outlet.
 */
router.get('/outlets', requireAnyAuth, async (req, res, next) => {
  try {
    const tampilkanSemua = req.query.semua === 'true' && req.user;

    let queryText = tampilkanSemua
      ? 'SELECT id, nama, gudang_asal_id, aktif FROM outlet ORDER BY nama'
      : 'SELECT id, nama, gudang_asal_id FROM outlet WHERE aktif = true ORDER BY nama';
    let params = [];

    if (req.device) {
      queryText = 'SELECT id, nama, gudang_asal_id FROM outlet WHERE aktif = true AND gudang_asal_id = $1 ORDER BY nama';
      params = [req.device.gudangId];
    }

    const { rows } = await pool.query(queryText, params);
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/master/items?konteks=crew | ?semua=true
 * konteks=crew -> buang item Bahan Adonan kecuali BA-008 Pandan Pasta.
 * semua=true (admin) -> termasuk item non-aktif, buat halaman manajemen.
 * Default -> semua item aktif.
 */
router.get('/items', requireAnyAuth, async (req, res, next) => {
  try {
    const konteksCrew = req.query.konteks === 'crew';
    const tampilkanSemua = req.query.semua === 'true' && req.user; // cuma admin yang boleh liat non-aktif

    let queryText;
    if (konteksCrew) {
      queryText = `SELECT id, kode_barang, nama, kategori, satuan FROM item
                   WHERE status_aktif = true AND (kategori != 'Bahan Adonan' OR kode_barang = 'BA-008')
                   ORDER BY kategori, nama`;
    } else if (tampilkanSemua) {
      queryText = `SELECT id, kode_barang, nama, kategori, satuan, status_aktif, gudang_default_id, catatan_migrasi
                   FROM item ORDER BY kategori, nama`;
    } else {
      queryText = `SELECT id, kode_barang, nama, kategori, satuan FROM item
                   WHERE status_aktif = true ORDER BY kategori, nama`;
    }

    const { rows } = await pool.query(queryText);
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /api/master/gudangs — daftar 3 gudang, buat Admin pilih mana yang mau di-QR-in */
router.get('/gudangs', requireAnyAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, nama, tipe FROM gudang ORDER BY nama');
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/** POST /api/master/items — buat item baru (admin) */
router.post('/items', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await buatItem(req.body);
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/master/items/:id — update item, termasuk reorder_point & status_aktif (admin) */
router.patch('/items/:id', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await updateItem(Number(req.params.id), req.body);
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** GET /api/master/reorder-points — daftar semua reorder point yang udah dikonfigurasi (admin) */
router.get('/reorder-points', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await listReorderPoints();
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/master/reorder-points — set/hapus reorder point 1 kombinasi item+gudang (admin).
 * Body: { itemId, gudangId, reorderPoint } — reorderPoint: angka buat set, null buat hapus.
 */
router.put('/reorder-points', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await setReorderPoint(req.body);
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** POST /api/master/outlets — buat outlet baru (admin) */
router.post('/outlets', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await buatOutlet(req.body);
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/master/outlets/:id — update outlet, termasuk toggle aktif (admin) */
router.patch('/outlets/:id', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await updateOutlet(Number(req.params.id), req.body);
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
