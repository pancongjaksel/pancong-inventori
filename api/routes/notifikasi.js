const express = require('express');
const { pool } = require('../db/pool');
const { requireDevice, requireAdmin, requireAnyAuth } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/notifikasi — list notifikasi milik requester
 * Crew: filter crew_gudang_id + crew_nama
 * Admin/owner: filter user_id
 */
router.get('/', requireAnyAuth, async (req, res, next) => {
  try {
    let rows;
    if (req.device && !req.user?.role?.includes('admin')) {
      // Crew
      ({ rows } = await pool.query(`
        SELECT id, tipe, judul, pesan, reference_tipe, reference_id, read_at, created_at
        FROM notifikasi
        WHERE crew_gudang_id = $1 AND crew_nama = $2
        ORDER BY created_at DESC
        LIMIT 50
      `, [req.device.gudangId, req.device.nama]));
    } else {
      // Admin / owner
      ({ rows } = await pool.query(`
        SELECT id, tipe, judul, pesan, reference_tipe, reference_id, read_at, created_at
        FROM notifikasi
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [req.user.id]));
    }
    res.json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/notifikasi/jumlah-belum-dibaca
 */
router.get('/jumlah-belum-dibaca', requireAnyAuth, async (req, res, next) => {
  try {
    let result;
    if (req.device && !req.user?.role?.includes('admin')) {
      ({ rows: [result] } = await pool.query(`
        SELECT COUNT(*) AS jumlah FROM notifikasi
        WHERE crew_gudang_id = $1 AND crew_nama = $2 AND read_at IS NULL
      `, [req.device.gudangId, req.device.nama]));
    } else {
      ({ rows: [result] } = await pool.query(`
        SELECT COUNT(*) AS jumlah FROM notifikasi
        WHERE user_id = $1 AND read_at IS NULL
      `, [req.user.id]));
    }
    res.json({ sukses: true, data: { jumlah: Number(result.jumlah) } });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notifikasi/:id/read — tandai satu notifikasi dibaca
 */
router.patch('/:id/read', requireAnyAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    let rows;

    if (req.device && !req.user?.role?.includes('admin')) {
      ({ rows } = await pool.query(`
        UPDATE notifikasi SET read_at = now()
        WHERE id = $1 AND crew_gudang_id = $2 AND crew_nama = $3 AND read_at IS NULL
        RETURNING id
      `, [id, req.device.gudangId, req.device.nama]));
    } else {
      ({ rows } = await pool.query(`
        UPDATE notifikasi SET read_at = now()
        WHERE id = $1 AND user_id = $2 AND read_at IS NULL
        RETURNING id
      `, [id, req.user.id]));
    }

    if (!rows.length) {
      return res.status(404).json({ sukses: false, pesan: 'Notifikasi tidak ditemukan atau sudah dibaca.' });
    }
    res.json({ sukses: true });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notifikasi/read-all — tandai semua dibaca
 */
router.patch('/read-all', requireAnyAuth, async (req, res, next) => {
  try {
    if (req.device && !req.user?.role?.includes('admin')) {
      await pool.query(`
        UPDATE notifikasi SET read_at = now()
        WHERE crew_gudang_id = $1 AND crew_nama = $2 AND read_at IS NULL
      `, [req.device.gudangId, req.device.nama]);
    } else {
      await pool.query(`
        UPDATE notifikasi SET read_at = now()
        WHERE user_id = $1 AND read_at IS NULL
      `, [req.user.id]);
    }
    res.json({ sukses: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
