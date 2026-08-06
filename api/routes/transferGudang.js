const express = require('express');
const { pool } = require('../db/pool');
const { requireAdmin } = require('../middleware/authMiddleware');
const { kirimTransfer, terimaTransfer } = require('../services/transferGudangService');

const router = express.Router();

/**
 * GET /api/transfer-gudang?status=dikirim
 * Default nampilin yang 'dikirim' (antrean nunggu diterima). status=semua
 * buat lihat semua riwayat (dipakai halaman Koreksi Transaksi).
 */
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'dikirim';
    const queryText = `
      SELECT
        tg.id, tg.jumlah, tg.status, tg.label_status,
        tg.foto_bukti_kirim_url, tg.foto_bukti_terima_url,
        tg.tanggal_kirim, tg.tanggal_terima,
        i.kode_barang, i.nama AS nama_item, i.satuan,
        ga.nama AS nama_gudang_asal, gt.nama AS nama_gudang_tujuan,
        uk.nama AS dikirim_oleh_nama, ut.nama AS diterima_oleh_nama
      FROM transfer_gudang tg
      JOIN item i ON i.id = tg.item_id
      JOIN gudang ga ON ga.id = tg.gudang_asal_id
      JOIN gudang gt ON gt.id = tg.gudang_tujuan_id
      JOIN users uk ON uk.id = tg.dikirim_oleh_user_id
      LEFT JOIN users ut ON ut.id = tg.diterima_oleh_user_id
      ${status === 'semua' ? '' : 'WHERE tg.status = $1'}
      ORDER BY tg.tanggal_kirim DESC
      LIMIT 100
    `;
    const { rows } = await pool.query(queryText, status === 'semua' ? [] : [status]);
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/** POST /api/transfer-gudang — langkah 1/2, Kirim (admin) */
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await kirimTransfer({ ...req.body, dikirimOlehUserId: req.user.id });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/transfer-gudang/:id/terima — langkah 2/2, Terima (admin) */
router.patch('/:id/terima', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await terimaTransfer({
      id: Number(req.params.id),
      diterimaOlehUserId: req.user.id,
      ...req.body,
    });
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
