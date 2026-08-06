const express = require('express');
const { pool } = require('../db/pool');
const { requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/laporan/stok-gudang?gudangId=
 * Snapshot stok real-time semua gudang (atau 1 gudang kalau di-filter),
 * dari view v_stok_gudang_saat_ini.
 */
router.get('/stok-gudang', requireAdmin, async (req, res, next) => {
  try {
    const { gudangId } = req.query;
    const queryText = gudangId
      ? 'SELECT * FROM v_stok_gudang_saat_ini WHERE gudang_id = $1 ORDER BY nama_item'
      : 'SELECT * FROM v_stok_gudang_saat_ini ORDER BY nama_gudang, nama_item';
    const { rows } = await pool.query(queryText, gudangId ? [gudangId] : []);
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/laporan/stok-menipis
 * Item yang stok-nya di bawah reorder_point (dari view v_stok_menipis).
 * Item dengan reorder_point belum di-set (NULL) otomatis gak pernah muncul.
 */
router.get('/stok-menipis', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM v_stok_menipis ORDER BY nama_gudang, nama_item');
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
