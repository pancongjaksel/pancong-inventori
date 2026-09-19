const express = require('express');
const { pool } = require('../db/pool');
const { requireDevice, requireAdminOrGudang, requireAdmin, requireAnyAuth } = require('../middleware/authMiddleware');
const { buatSesiPengambilanCrew, verifikasiPengambilan } = require('../services/pengambilanCrewService');
const { onCatatanDitambahkan } = require('../services/aktivitasPengambilanService');

const router = express.Router();

/**
 * GET /api/sesi-pengambilan-crew — riwayat sesi terbaru (Admin)
 */
router.get('/', requireAdminOrGudang, async (req, res, next) => {
  try {
    const { gudang_id, outlet_id, dari, sampai, search, limit, offset } = req.query;
    const batas = Math.min(Number(limit) || 50, 200);
    const mulai = Number(offset) || 0;

    const kondisi = ['TRUE'];
    const params = [];

    if (gudang_id) { params.push(gudang_id); kondisi.push(`spc.gudang_asal_id = $${params.length}`); }
    if (outlet_id) { params.push(outlet_id); kondisi.push(`spc.outlet_tujuan_id = $${params.length}`); }
    if (dari) { params.push(dari); kondisi.push(`spc.tanggal >= $${params.length}`); }
    if (sampai) { params.push(sampai); kondisi.push(`spc.tanggal <= $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      kondisi.push(`(spc.nama_crew ILIKE $${params.length} OR o.nama ILIKE $${params.length})`);
    }

    params.push(batas, mulai);
    const { rows } = await pool.query(`
      SELECT
        spc.id, spc.nama_crew, spc.tanggal, spc.created_at, spc.label_status,
        ga.nama AS nama_gudang_asal, o.nama AS nama_outlet_tujuan,
        json_agg(json_build_object('item', i.nama, 'qty', spi.qty, 'satuan', i.satuan) ORDER BY i.nama) AS daftar_item,
        COUNT(*) OVER() AS total_count
      FROM sesi_pengambilan_crew spc
      JOIN gudang ga ON ga.id = spc.gudang_asal_id
      JOIN outlet o ON o.id = spc.outlet_tujuan_id
      JOIN sesi_pengambilan_item spi ON spi.sesi_id = spc.id
      JOIN item i ON i.id = spi.item_id
      WHERE ${kondisi.join(' AND ')}
      GROUP BY spc.id, ga.nama, o.nama
      ORDER BY spc.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sesi-pengambilan-crew/saya — riwayat sesi milik device ini
 */
router.get('/saya', requireDevice, async (req, res, next) => {
  try {
    const { filter } = req.query; // 'hari-ini' | '7-hari' | kosong = semua
    const kondisiTanggal = filter === 'hari-ini'
      ? "AND spc.tanggal = CURRENT_DATE"
      : filter === '7-hari'
        ? "AND spc.tanggal >= CURRENT_DATE - INTERVAL '7 days'"
        : '';

    const { rows } = await pool.query(`
      SELECT
        spc.id, spc.nama_crew, spc.tanggal, spc.created_at, spc.label_status,
        ga.nama AS nama_gudang_asal, o.nama AS nama_outlet_tujuan,
        COUNT(spi.id)::int AS jumlah_item,
        SUM(spi.qty)::numeric AS total_qty,
        json_agg(json_build_object('item', i.nama, 'qty', spi.qty, 'satuan', i.satuan) ORDER BY i.nama) AS daftar_item
      FROM sesi_pengambilan_crew spc
      JOIN gudang ga ON ga.id = spc.gudang_asal_id
      JOIN outlet o ON o.id = spc.outlet_tujuan_id
      JOIN sesi_pengambilan_item spi ON spi.sesi_id = spc.id
      JOIN item i ON i.id = spi.item_id
      WHERE spc.gudang_asal_id = $1 AND spc.nama_crew = $2 ${kondisiTanggal}
      GROUP BY spc.id, ga.nama, o.nama
      ORDER BY spc.created_at DESC
      LIMIT 50
    `, [req.device.gudangId, req.device.nama]);
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sesi-pengambilan-crew/gudang/:gudang_id — riwayat 30 hari per gudang
 * Auth: device crew. Device harus berada di gudang yang sama dengan URL param.
 */
router.get('/gudang/:gudang_id', requireDevice, async (req, res, next) => {
  try {
    const gudangId = Number(req.params.gudang_id);
    if (!gudangId || req.device.gudangId !== gudangId) {
      return res.status(403).json({ sukses: false, kode: 'AKSES_DITOLAK', pesan: 'Kamu tidak bisa melihat riwayat gudang lain.' });
    }

    const { rows } = await pool.query(`
      SELECT
        spc.id, spc.tanggal, spc.created_at, spc.nama_crew, spc.label_status,
        o.nama AS nama_outlet_tujuan,
        json_agg(
          json_build_object(
            'nama_item', i.nama,
            'qty', spi.qty,
            'qty_asli', spi.qty_asli,
            'dikoreksi_oleh', spi.dikoreksi_oleh,
            'satuan', i.satuan
          ) ORDER BY i.nama
        ) AS items
      FROM sesi_pengambilan_crew spc
      JOIN outlet o ON o.id = spc.outlet_tujuan_id
      JOIN sesi_pengambilan_item spi ON spi.sesi_id = spc.id
      JOIN item i ON i.id = spi.item_id
      WHERE spc.gudang_asal_id = $1
        AND spc.tanggal >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY spc.id, o.nama
      ORDER BY spc.created_at DESC
      LIMIT 50
    `, [gudangId]);

    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sesi-pengambilan-crew/:id — detail sesi
 * Crew: hanya miliknya (gudang + nama). Admin: semua.
 */
router.get('/:id', requireAnyAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: header } = await pool.query(`
      SELECT
        spc.id, spc.nama_crew, spc.tanggal, spc.created_at, spc.label_status,
        ga.id AS gudang_asal_id, ga.nama AS nama_gudang_asal,
        o.id AS outlet_tujuan_id, o.nama AS nama_outlet_tujuan
      FROM sesi_pengambilan_crew spc
      JOIN gudang ga ON ga.id = spc.gudang_asal_id
      JOIN outlet o ON o.id = spc.outlet_tujuan_id
      WHERE spc.id = $1
    `, [id]);

    if (!header.length) {
      return res.status(404).json({ sukses: false, pesan: 'Sesi tidak ditemukan.' });
    }

    const sesi = header[0];

    // Crew: hanya boleh lihat sesi miliknya
    if (req.device && !req.user?.role?.includes('admin')) {
      if (sesi.gudang_asal_id !== req.device.gudangId || sesi.nama_crew !== req.device.nama) {
        return res.status(403).json({ sukses: false, pesan: 'Akses ditolak.' });
      }
    }

    const { rows: items } = await pool.query(`
      SELECT
        i.id AS item_id, i.nama, i.satuan, i.kode_barang,
        spi.qty, spi.qty_asli, spi.dikoreksi_oleh, spi.dikoreksi_at
      FROM sesi_pengambilan_item spi
      JOIN item i ON i.id = spi.item_id
      WHERE spi.sesi_id = $1
      ORDER BY i.nama
    `, [id]);

    res.status(200).json({ sukses: true, data: { ...sesi, items } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sesi-pengambilan-crew/:id/aktivitas — timeline aktivitas
 */
router.get('/:id/aktivitas', requireAnyAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verifikasi sesi ada + auth crew
    const { rows: sesiRows } = await pool.query(
      'SELECT gudang_asal_id, nama_crew FROM sesi_pengambilan_crew WHERE id = $1', [id]
    );
    if (!sesiRows.length) {
      return res.status(404).json({ sukses: false, pesan: 'Sesi tidak ditemukan.' });
    }
    const sesi = sesiRows[0];
    if (req.device && !req.user?.role?.includes('admin')) {
      if (sesi.gudang_asal_id !== req.device.gudangId || sesi.nama_crew !== req.device.nama) {
        return res.status(403).json({ sukses: false, pesan: 'Akses ditolak.' });
      }
    }

    const { rows } = await pool.query(`
      SELECT
        ap.id, ap.tipe, ap.actor_tipe, ap.actor_nama,
        ap.judul, ap.deskripsi, ap.metadata, ap.created_at
      FROM aktivitas_pengambilan ap
      WHERE ap.sesi_pengambilan_id = $1
      ORDER BY ap.created_at ASC
    `, [id]);

    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sesi-pengambilan-crew/:id/catatan — tambah catatan (admin/owner)
 */
router.post('/:id/catatan', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { catatan } = req.body;

    if (!catatan?.trim()) {
      return res.status(400).json({ sukses: false, pesan: 'Catatan tidak boleh kosong.' });
    }

    const { rows } = await pool.query(
      'SELECT gudang_asal_id, nama_crew FROM sesi_pengambilan_crew WHERE id = $1', [id]
    );
    if (!rows.length) {
      return res.status(404).json({ sukses: false, pesan: 'Sesi tidak ditemukan.' });
    }

    await onCatatanDitambahkan(pool, {
      sesiId: Number(id),
      actorUserId: req.user.id,
      actorNama: req.user.nama,
      actorRole: req.user.role,
      catatan: catatan.trim(),
      crewGudangId: rows[0].gudang_asal_id,
      crewNama: rows[0].nama_crew,
    });

    res.status(201).json({ sukses: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sesi-pengambilan-crew
 */
router.post('/', requireDevice, async (req, res, next) => {
  try {
    const { outletTujuanId, daftarItem } = req.body;
    const hasil = await buatSesiPengambilanCrew({
      namaCrew: req.device.nama,
      gudangAsalId: req.device.gudangId,
      outletTujuanId,
      daftarItem,
      crewId: req.device.crewId,
      crewSessionId: req.device.crewSessionId,
      deviceId: req.device.id,
      idempotencyKey: req.get('Idempotency-Key'),
    });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/verifikasi', requireAdminOrGudang, async (req, res, next) => {
  try {
    const hasil = await verifikasiPengambilan({
      id: Number(req.params.id), ...req.body,
      adminUserId: req.user.id, adminUserRole: req.user.role,
      idempotencyKey: req.get('Idempotency-Key'),
    });
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) { next(err); }
});

module.exports = router;
