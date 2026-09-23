const express = require('express');
const { pool } = require('../db/pool');
const { requireAdminOrGudang, requireAdmin } = require('../middleware/authMiddleware');
const { kirimTransfer, terimaTransfer, verifikasiTransfer } = require('../services/transferGudangService');

const router = express.Router();

/**
 * GET /api/transfer-gudang?status=dikirim
 * Default nampilin yang 'dikirim' (antrean nunggu diterima). status=semua
 * buat lihat semua riwayat (dipakai halaman Koreksi Transaksi).
 */
router.get('/', requireAdminOrGudang, async (req, res, next) => {
  try {
    const { status = 'dikirim', dari, sampai, search, limit, offset } = req.query;
    const batas = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const mulai = Math.max(Number(offset) || 0, 0);
    const kondisi = [];
    const params = [];
    if (status !== 'semua') {
      params.push(status);
      kondisi.push(`tg.status = $${params.length}`);
    }
    if (dari) {
      params.push(dari);
      kondisi.push(`tg.tanggal_kirim >= $${params.length}::date`);
    }
    if (sampai) {
      params.push(sampai);
      kondisi.push(`tg.tanggal_kirim < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      kondisi.push(`(i.nama ILIKE $${params.length} OR ga.nama ILIKE $${params.length} OR gt.nama ILIKE $${params.length} OR uk.nama ILIKE $${params.length})`);
    }
    params.push(batas, mulai);
    const queryText = `
      SELECT
        tg.id, tg.jumlah, tg.status, tg.label_status, tg.status_verifikasi, tg.sumber_transaksi, tg.dibuat_oleh_role,
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
      WHERE ${kondisi.length ? kondisi.join(' AND ') : 'TRUE'}
      ORDER BY tg.tanggal_kirim DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const { rows } = await pool.query(queryText, params);
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /api/transfer-gudang/:id — detail satu transfer */
router.get('/:id', requireAdminOrGudang, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        tg.id, tg.jumlah, tg.status, tg.label_status, tg.status_verifikasi, tg.sumber_transaksi, tg.dibuat_oleh_role,
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
      WHERE tg.id = $1
    `, [Number(req.params.id)]);
    if (rows.length === 0) return res.status(404).json({ sukses: false, pesan: 'Transfer tidak ditemukan.' });
    res.status(200).json({ sukses: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

/** POST /api/transfer-gudang — langkah 1/2, Kirim (admin) */
router.post('/', requireAdminOrGudang, async (req, res, next) => {
  try {
    const hasil = await kirimTransfer({ ...req.body, dikirimOlehUserId: req.user.id, dikirimOlehRole: req.user.role });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/transfer-gudang/:id/terima — langkah 2/2, Terima (admin) */
router.patch('/:id/terima', requireAdminOrGudang, async (req, res, next) => {
  try {
    const hasil = await terimaTransfer({
      id: Number(req.params.id),
      ...req.body,
      diterimaOlehUserId: req.user.id,
      diterimaOlehRole: req.user.role,
    });
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/verifikasi', requireAdmin, async (req, res, next) => { try { if (req.user.role !== 'owner') return res.status(403).json({ sukses:false, pesan:'Hanya Owner yang dapat memverifikasi transfer.' }); const data = await verifikasiTransfer({ id:Number(req.params.id), ownerUserId:req.user.id, aksi:req.body.aksi, catatan:req.body.catatan, bukti:req.body.bukti, idempotencyKey:req.get('Idempotency-Key') }); res.json({ sukses:true, data }); } catch (err) { next(err); } });

module.exports = router;
