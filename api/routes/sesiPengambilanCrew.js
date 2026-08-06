const express = require('express');
const { pool } = require('../db/pool');
const { requireDevice, requireAdmin } = require('../middleware/authMiddleware');
const { buatSesiPengambilanCrew } = require('../services/pengambilanCrewService');

const router = express.Router();

/**
 * GET /api/sesi-pengambilan-crew — riwayat sesi terbaru (Admin), termasuk
 * daftar item tiap sesi (agregat jadi array JSON per baris).
 */
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        spc.id, spc.nama_crew, spc.tanggal, spc.created_at, spc.label_status,
        ga.nama AS nama_gudang_asal, o.nama AS nama_outlet_tujuan,
        json_agg(json_build_object('item', i.nama, 'qty', spi.qty, 'satuan', i.satuan) ORDER BY i.nama) AS daftar_item
      FROM sesi_pengambilan_crew spc
      JOIN gudang ga ON ga.id = spc.gudang_asal_id
      JOIN outlet o ON o.id = spc.outlet_tujuan_id
      JOIN sesi_pengambilan_item spi ON spi.sesi_id = spc.id
      JOIN item i ON i.id = spi.item_id
      GROUP BY spc.id, ga.nama, o.nama
      ORDER BY spc.created_at DESC
      LIMIT 100
    `);
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sesi-pengambilan-crew
 * Header: X-Device-Token (wajib, lihat middleware requireDevice)
 * Body: { namaCrew, outletTujuanId, daftarItem: [{itemId, qty}] }
 *
 * gudangAsalId & deviceId TIDAK lagi diterima dari body — diambil dari
 * req.device (hasil verifikasi token device), supaya crew gak bisa
 * ngaku-ngaku ambil dari gudang lain selain yang device-nya emang di-setup.
 */
router.post('/', requireDevice, async (req, res, next) => {
  try {
    const { namaCrew, outletTujuanId, daftarItem } = req.body;
    const hasil = await buatSesiPengambilanCrew({
      namaCrew,
      gudangAsalId: req.device.gudangId,
      outletTujuanId,
      deviceId: req.device.id,
      daftarItem,
    });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
