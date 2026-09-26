const express = require('express');
const { pool } = require('../db/pool');
const { requireAnyAuth, requireAdmin } = require('../middleware/authMiddleware');
const { buatItem, updateItem } = require('../services/itemService');
const { buatOutlet, updateOutlet } = require('../services/outletService');

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

    if (req.device?.gudangId) {
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
 * GET /api/master/items?konteks=crew | ?semua=true | ?gudang_id=
 * konteks=crew -> buang item Bahan Adonan kecuali BA-008 Pandan Pasta.
 * semua=true (admin) -> termasuk item non-aktif, buat halaman manajemen.
 * gudang_id (opsional, cuma berlaku di jalur default) -> buang item Bahan
 *   Adonan yang bukan milik gudang itu dan bukan pengecualian
 *   (selalu_tampil_semua_gudang), dipakai StokOpname.jsx mode gudang. Kalau
 *   gudang_id gak dikirim, behavior sama seperti sebelumnya (semua item aktif).
 * Default -> semua item aktif.
 */
router.get('/items', requireAnyAuth, async (req, res, next) => {
  try {
    const konteksCrew = req.query.konteks === 'crew';
    const tampilkanSemua = req.query.semua === 'true' && req.user; // cuma admin yang boleh liat non-aktif
    const gudangId = req.query.gudang_id || null;

    let queryText;
    let params = [];
    if (konteksCrew) {
      queryText = `SELECT id, kode_barang, nama, kategori, satuan FROM item
                   WHERE status_aktif = true AND (kategori != 'Bahan Adonan' OR kode_barang = 'BA-008')
                   ORDER BY kategori, nama`;
    } else if (tampilkanSemua) {
      queryText = `SELECT id, kode_barang, nama, kategori, satuan, reorder_point, status_aktif, gudang_default_id, catatan_migrasi, harga
                   FROM item ORDER BY kategori, nama`;
    } else {
      queryText = `SELECT id, kode_barang, nama, kategori, satuan, reorder_point FROM item
                   WHERE status_aktif = true
                     AND (
                       $1::int IS NULL
                       OR kategori != 'Bahan Adonan'
                       OR selalu_tampil_semua_gudang = true
                       OR gudang_default_id = $1
                     )
                   ORDER BY kategori, nama`;
      params = [gudangId];
    }

    const { rows } = await pool.query(queryText, params);
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

/** GET /api/master/vendors — daftar vendor aktif untuk form barang masuk. */
router.get('/vendors', requireAnyAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, nama FROM vendor WHERE aktif = true ORDER BY nama');
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /api/master/items-outlet — item relevan untuk opname outlet (Topping, Kemasan, Pandan Pasta) */
router.get('/items-outlet', requireAnyAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, nama, kode_barang, kategori, satuan, harga
      FROM item
      WHERE (kategori IN ('Topping', 'Kemasan') OR kode_barang = 'BA-008')
        AND status_aktif = true
      ORDER BY kategori, nama
    `);
    res.json({ sukses: true, data: rows });
  } catch (err) { next(err); }
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

/** PATCH /api/master/items/batch-harga — update harga banyak item sekaligus (admin) */
router.patch('/items/batch-harga', requireAdmin, async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ sukses: false, pesan: 'items wajib berupa array tidak kosong.' });
    }
    for (const it of items) {
      if (!Number.isInteger(it.id) || !Number.isInteger(it.harga) || it.harga < 0) {
        return res.status(400).json({ sukses: false, pesan: 'Setiap item harus punya id (integer) dan harga (integer ≥ 0).' });
      }
    }
    const ids = items.map((it) => it.id);
    const hargas = items.map((it) => it.harga);
    await pool.query(
      `UPDATE item SET harga = v.harga, updated_at = now()
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS harga) AS v
       WHERE item.id = v.id`,
      [ids, hargas]
    );
    res.status(200).json({ sukses: true, pesan: `${items.length} item diperbarui.` });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/master/items/batch-reorder — update reorder_point banyak item sekaligus (admin) */
router.patch('/items/batch-reorder', requireAdmin, async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ sukses: false, pesan: 'items wajib berupa array tidak kosong.' });
    }
    for (const it of items) {
      if (!Number.isInteger(it.id) || !Number.isInteger(it.reorderPoint) || it.reorderPoint < 0) {
        return res.status(400).json({ sukses: false, pesan: 'Setiap item harus punya id (integer) dan reorderPoint (integer ≥ 0).' });
      }
    }
    const ids = items.map((it) => it.id);
    const reorderPoints = items.map((it) => it.reorderPoint);
    await pool.query(
      `UPDATE item SET reorder_point = v.rp, updated_at = now()
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS rp) AS v
       WHERE item.id = v.id`,
      [ids, reorderPoints]
    );
    res.status(200).json({ sukses: true, pesan: `${items.length} item diperbarui.` });
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
