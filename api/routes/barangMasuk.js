const express = require('express');
const { pool } = require('../db/pool');
const { requireAdmin, requireDevice } = require('../middleware/authMiddleware');
const {
  buatBarangMasukAdmin,
  buatBarangMasukCrew,
  verifikasiBarangMasuk,
} = require('../services/barangMasukService');

const router = express.Router();

/**
 * GET /api/barang-masuk?status=menunggu
 * Default nampilin yang 'menunggu' verifikasi (antrean Admin). Bisa filter
 * status lain (terverifikasi/direvisi/ditolak) lewat query param.
 */
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'menunggu';
    const { rows } = await pool.query(
      `SELECT
         tm.id, tm.jumlah, tm.satuan, tm.sumber, tm.foto_bukti_url,
         tm.diinput_oleh_role, tm.nama_crew_input, tm.status_verifikasi,
         tm.label_status, tm.catatan_verifikasi, tm.tanggal, tm.created_at,
         i.kode_barang, i.nama AS nama_item,
         g.nama AS nama_gudang,
         u.nama AS diinput_oleh_admin_nama
       FROM transaksi_masuk tm
       JOIN item i ON i.id = tm.item_id
       JOIN gudang g ON g.id = tm.gudang_id
       LEFT JOIN users u ON u.id = tm.diinput_oleh_user_id
       WHERE tm.status_verifikasi = $1
       ORDER BY tm.created_at DESC`,
      [status]
    );
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/** POST /api/barang-masuk/admin — Admin login, langsung terverifikasi */
router.post('/admin', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await buatBarangMasukAdmin({ ...req.body, adminUserId: req.user.id });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** POST /api/barang-masuk/crew — device Crew, status "menunggu" */
router.post('/crew', requireDevice, async (req, res, next) => {
  try {
    const hasil = await buatBarangMasukCrew({
      ...req.body,
      gudangId: req.device.gudangId,
      deviceId: req.device.id,
    });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/barang-masuk/:id/verifikasi
 * Body: { aksi: 'setujui' | 'revisi' | 'tolak', catatan?, jumlahRevisi? }
 */
router.patch('/:id/verifikasi', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await verifikasiBarangMasuk({
      id: Number(req.params.id),
      adminUserId: req.user.id,
      ...req.body,
    });
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
