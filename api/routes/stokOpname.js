const express = require('express');
const { requireAdminOrGudang, requireAdmin, requireDevice } = require('../middleware/authMiddleware');
const { buatOpnameGudang, buatOpnameOutlet, buatOpnameOutletCrew } = require('../services/stokOpnameService');
const { generateRekapForecast, generateRekapForecastExcel } = require('../services/rekapForecastService');
const { pool } = require('../db/pool');

const router = express.Router();

/** POST /api/stok-opname/gudang (admin/owner atau device Admin Gudang) */
router.post('/gudang', requireAdminOrGudang, async (req, res, next) => {
  try {
    const hasil = await buatOpnameGudang({ ...req.body, userId: req.user.id });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** POST /api/stok-opname/outlet/crew (device crew biasa — gudang dari token) */
router.post('/outlet/crew', requireDevice, async (req, res, next) => {
  try {
    const { outletId, itemId, stokFisik, periode, stokAwalManual, tanggal, tipeOpname } = req.body;
    const hasil = await buatOpnameOutletCrew({
      outletId,
      itemId,
      stokFisik,
      periode,
      deviceId: req.device.id ?? null,
      stokAwalManual,
      tanggal,
      tipeOpname,
    });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** POST /api/stok-opname/outlet (admin/owner atau device Admin Gudang) */
router.post('/outlet', requireAdminOrGudang, async (req, res, next) => {
  try {
    const hasil = await buatOpnameOutlet({ ...req.body, userId: req.user.id });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stok-opname/rekap?periode=2026-08 (admin/owner atau device Admin Gudang — laporan)
 */
router.get('/rekap', requireAdminOrGudang, async (req, res, next) => {
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
 * GET /api/stok-opname/rekap/export?periode=2026-08 (admin/owner atau device Admin Gudang)
 * Balikin file .xlsx beneran (bukan JSON) — Content-Disposition attachment,
 * langsung ke-download browser.
 */
router.get('/rekap/export', requireAdminOrGudang, async (req, res, next) => {
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

// GET /api/stok-opname/approval — list sesi menunggu (admin only)
router.get('/approval', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        so.sesi_id,
        g.nama AS nama_gudang,
        so.tanggal,
        so.jenis_opname,
        so.status,
        MIN(so.created_at) AS created_at,
        u.nama AS dicatat_oleh,
        COUNT(so.id)::INTEGER AS jumlah_item,
        SUM(ABS(so.selisih))::NUMERIC AS total_selisih
      FROM stok_opname so
      JOIN gudang g ON g.id = so.gudang_id
      LEFT JOIN users u ON u.id = so.dicatat_oleh_user_id
      WHERE so.lokasi_tipe = 'gudang' AND so.status = 'menunggu'
      GROUP BY so.sesi_id, g.nama, so.tanggal, so.jenis_opname,
               so.status, u.nama
      ORDER BY so.tanggal DESC, created_at DESC
    `);
    res.json({ sukses: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/stok-opname/sesi/:sesiId — detail sesi
router.get('/sesi/:sesiId', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        so.id, so.item_id, i.nama AS nama_item, i.kode_barang, i.satuan,
        so.stok_sistem_atau_diterima AS stok_sistem,
        so.stok_fisik, so.selisih, so.sesi_id, so.status,
        so.tanggal, so.jenis_opname, g.nama AS nama_gudang
      FROM stok_opname so
      JOIN item i ON i.id = so.item_id
      JOIN gudang g ON g.id = so.gudang_id
      WHERE so.sesi_id = $1
      ORDER BY i.nama
    `, [req.params.sesiId]);
    if (rows.length === 0) return res.status(404).json({ sukses: false, pesan: 'Sesi tidak ditemukan.' });
    res.json({ sukses: true, data: rows });
  } catch (err) { next(err); }
});

// PATCH /api/stok-opname/item/:id — edit qty item sebelum approve
router.patch('/item/:id', requireAdmin, async (req, res, next) => {
  try {
    const { stokFisik } = req.body;
    if (stokFisik === undefined || stokFisik < 0) {
      return res.status(400).json({ sukses: false, pesan: 'stokFisik wajib dan >= 0.' });
    }
    const { rows: [item] } = await pool.query(
      'SELECT * FROM stok_opname WHERE id = $1', [req.params.id]
    );
    if (!item) return res.status(404).json({ sukses: false, pesan: 'Item tidak ditemukan.' });
    if (item.status === 'diapprove') {
      return res.status(400).json({ sukses: false, pesan: 'Sesi sudah diapprove, tidak bisa diedit.' });
    }
    await pool.query(`
      UPDATE stok_opname
      SET stok_fisik = $1,
          selisih = stok_sistem_atau_diterima - $1
      WHERE id = $2
    `, [stokFisik, req.params.id]);
    res.json({ sukses: true });
  } catch (err) { next(err); }
});

// POST /api/stok-opname/sesi/:sesiId/approve — approve sesi
router.post('/sesi/:sesiId/approve', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { sesuaikanStok = false } = req.body;
    const { rows: items } = await client.query(
      "SELECT * FROM stok_opname WHERE sesi_id = $1 AND lokasi_tipe = 'gudang'",
      [req.params.sesiId]
    );
    if (items.length === 0) return res.status(404).json({ sukses: false, pesan: 'Sesi tidak ditemukan.' });
    if (items[0].status === 'diapprove') {
      return res.status(400).json({ sukses: false, pesan: 'Sesi sudah diapprove sebelumnya.' });
    }

    await client.query('BEGIN');

    if (sesuaikanStok) {
      for (const item of items) {
        if (Number(item.selisih) !== 0) {
          await client.query(`
            INSERT INTO stok_ledger
              (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
            VALUES ($1, $2, 'opname_penyesuaian', $3, 'stok_opname', $4, now())
          `, [item.item_id, item.gudang_id, -Number(item.selisih), item.id]);
        }
      }
    }

    await client.query(
      "UPDATE stok_opname SET status = 'diapprove' WHERE sesi_id = $1",
      [req.params.sesiId]
    );

    await client.query('COMMIT');
    res.json({
      sukses: true,
      data: {
        totalItem: items.length,
        totalDisesuaikan: sesuaikanStok ? items.filter(i => Number(i.selisih) !== 0).length : 0,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

module.exports = router;
