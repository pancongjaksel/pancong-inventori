const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { requireAdmin, requireAdminOrGudang, requireAnyAuth } = require('../middleware/authMiddleware');

function adalahSesiCrew(req) {
  return Boolean(req.device && !req.user);
}

async function pastikanOutletSesuaiGudangCrew(client, req, outletId) {
  if (!adalahSesiCrew(req)) return;

  const { rows } = await client.query(
    `SELECT id
     FROM outlet
     WHERE id = $1 AND gudang_asal_id = $2 AND aktif = true`,
    [outletId, req.device.gudangId]
  );
  if (!rows.length) {
    return Object.assign(new Error('Outlet tidak tersedia untuk gudang crew ini.'), {
      statusCode: 403,
      kode: 'OUTLET_TIDAK_SESUAI_GUDANG',
    });
  }
  return null;
}

function rentangClosingPeriode(periode) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode || '')) return null;
  const [tahun, bulan] = periode.split('-').map(Number);
  const dari = `${periode}-01`;
  const sampai = new Date(Date.UTC(tahun, bulan, 0)).toISOString().slice(0, 10);
  return { dari, sampai };
}

function tanggalJakartaHariIni() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const nilai = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return `${nilai.year}-${nilai.month}-${nilai.day}`;
}

// GET /opname-outlet/outlets
router.get('/outlets', requireAnyAuth, async (req, res, next) => {
  try {
    const params = [];
    const kondisi = ['aktif = true'];
    if (adalahSesiCrew(req)) {
      params.push(req.device.gudangId);
      kondisi.push(`gudang_asal_id = $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT id, nama FROM outlet WHERE ${kondisi.join(' AND ')} ORDER BY nama`,
      params
    );
    res.json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /opname-outlet/items
router.get('/items', requireAnyAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, kode_barang, nama, kategori, satuan, harga
       FROM item
       WHERE (kategori IN ('Topping', 'Kemasan') OR kode_barang = 'BA-008')
         AND kode_barang NOT IN ('K-001', 'X-002')
         AND status_aktif = true
       ORDER BY kategori, nama`
    );
    res.json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /opname-outlet/pending/jumlah  (sebelum /pending agar tidak clash)
router.get('/pending/jumlah', requireAdminOrGudang, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS jumlah FROM opname_outlet WHERE status = 'menunggu_approval'`
    );
    res.json({ sukses: true, data: { jumlah: Number(rows[0].jumlah) } });
  } catch (err) {
    next(err);
  }
});

// GET /opname-outlet/pending
router.get('/pending', requireAdminOrGudang, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT oo.id, oo.tanggal_opname, oo.periode_dari, oo.periode_sampai,
              oo.dibuat_oleh, oo.created_at, oo.status, o.nama AS nama_outlet
       FROM opname_outlet oo
       JOIN outlet o ON o.id = oo.outlet_id
       WHERE oo.status = 'menunggu_approval'
       ORDER BY oo.created_at DESC`
    );
    res.json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /opname-outlet/pengambilan-preview?outlet_id=&dari=&sampai=
router.get('/pengambilan-preview', requireAnyAuth, async (req, res, next) => {
  const { outlet_id, dari, sampai } = req.query;
  if (!outlet_id || !dari || !sampai) {
    return res.status(400).json({ sukses: false, pesan: 'outlet_id, dari, dan sampai wajib diisi.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT
         CASE
           WHEN i.kode_barang = 'K-001' THEN (SELECT id FROM item WHERE kode_barang = 'K-008')
           WHEN i.kode_barang = 'X-002' THEN (SELECT id FROM item WHERE kode_barang = 'X-004')
           ELSE spi.item_id
         END AS item_id,
         SUM(spi.qty * i.faktor_konversi) AS total_diambil
       FROM sesi_pengambilan_crew spc
       JOIN sesi_pengambilan_item spi ON spi.sesi_id = spc.id
       JOIN item i ON i.id = spi.item_id
       WHERE spc.outlet_tujuan_id = $1
         AND spc.tanggal::date BETWEEN $2 AND $3
         AND spc.label_status IS DISTINCT FROM 'Dikoreksi'
       GROUP BY 1`,
      [outlet_id, dari, sampai]
    );
    const map = {};
    rows.forEach((r) => { map[r.item_id] = Number(r.total_diambil); });
    res.json({ sukses: true, data: map });
  } catch (err) {
    next(err);
  }
});

// GET /opname-outlet/stok-awal/:outlet_id/:item_id
router.get('/stok-awal/:outlet_id/:item_id', requireAnyAuth, async (req, res, next) => {
  const { outlet_id, item_id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT ooi.stok_akhir
       FROM opname_outlet oo
       JOIN opname_outlet_item ooi ON ooi.opname_id = oo.id
       WHERE oo.outlet_id = $1 AND ooi.item_id = $2
         AND oo.status = 'approved'
       ORDER BY oo.tanggal_opname DESC
       LIMIT 1`,
      [outlet_id, item_id]
    );
    const stok_awal = rows.length > 0 ? Number(rows[0].stok_akhir) : 0;
    res.json({ sukses: true, data: { stok_awal } });
  } catch (err) {
    next(err);
  }
});

// GET /opname-outlet/riwayat/:outlet_id
router.get('/riwayat/:outlet_id', requireAnyAuth, async (req, res, next) => {
  const { outlet_id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT oo.id, oo.tanggal_opname, oo.periode_dari, oo.periode_sampai,
              oo.dibuat_oleh, oo.created_at, oo.status, oo.catatan_approval,
              COALESCE(SUM(ooi.hpp), 0) AS total_hpp
       FROM opname_outlet oo
       LEFT JOIN opname_outlet_item ooi ON ooi.opname_id = oo.id
       WHERE oo.outlet_id = $1
       GROUP BY oo.id
       ORDER BY oo.tanggal_opname DESC`,
      [outlet_id]
    );
    res.json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /opname-outlet/laporan?opname_id=  (hanya approved — untuk HPP report)
router.get('/laporan', requireAnyAuth, async (req, res, next) => {
  const { opname_id } = req.query;
  if (!opname_id) {
    return res.status(400).json({ sukses: false, pesan: 'opname_id wajib diisi.' });
  }
  try {
    const { rows: header } = await pool.query(
      `SELECT oo.id, oo.tanggal_opname, oo.periode_dari, oo.periode_sampai,
              oo.dibuat_oleh, oo.created_at, o.nama AS nama_outlet, oo.status
       FROM opname_outlet oo
       JOIN outlet o ON o.id = oo.outlet_id
       WHERE oo.id = $1 AND oo.status = 'approved'`,
      [opname_id]
    );
    if (!header.length) {
      return res.status(404).json({ sukses: false, pesan: 'Opname tidak ditemukan.' });
    }
    const { rows: items } = await pool.query(
      `SELECT i.kode_barang, i.nama, i.satuan, i.kategori,
              ooi.stok_awal, ooi.pengambilan, ooi.stok_akhir,
              ooi.pemakaian, ooi.harga, ooi.hpp, ooi.catatan
       FROM opname_outlet_item ooi
       JOIN item i ON i.id = ooi.item_id
       WHERE ooi.opname_id = $1
       ORDER BY i.kategori, i.nama`,
      [opname_id]
    );
    const total_hpp = items.reduce((acc, r) => acc + Number(r.hpp || 0), 0);
    res.json({ sukses: true, data: { ...header[0], items, total_hpp } });
  } catch (err) {
    next(err);
  }
});

// GET /opname-outlet/:id/detail  (tanpa filter status — untuk crew edit opname ditolak)
router.get('/:id/detail', requireAnyAuth, async (req, res, next) => {
  const { id } = req.params;
  try {
    const { rows: header } = await pool.query(
      `SELECT oo.id, oo.tanggal_opname, oo.periode_dari, oo.periode_sampai,
              oo.dibuat_oleh, oo.status, oo.catatan_approval, o.nama AS nama_outlet
       FROM opname_outlet oo
       JOIN outlet o ON o.id = oo.outlet_id
       WHERE oo.id = $1`,
      [id]
    );
    if (!header.length) {
      return res.status(404).json({ sukses: false, pesan: 'Opname tidak ditemukan.' });
    }
    const { rows: items } = await pool.query(
      `SELECT i.id AS item_id, i.kode_barang, i.nama, i.satuan, i.kategori,
              ooi.stok_awal, ooi.pengambilan, ooi.stok_akhir,
              ooi.pemakaian, ooi.harga, ooi.hpp, ooi.catatan
       FROM opname_outlet_item ooi
       JOIN item i ON i.id = ooi.item_id
       WHERE ooi.opname_id = $1
       ORDER BY i.kategori, i.nama`,
      [id]
    );
    res.json({ sukses: true, data: { ...header[0], items } });
  } catch (err) {
    next(err);
  }
});

// POST /opname-outlet
router.post('/', requireAnyAuth, async (req, res, next) => {
  const { outlet_id, tanggal_opname, periode_dari, periode_sampai, items } = req.body;
  const dibuat_oleh = req.user?.nama ?? req.device?.nama ?? 'Crew';
  const dari_crew = req.device && !req.user?.role?.includes('admin');
  const status = dari_crew ? 'menunggu_approval' : 'approved';

  if (!outlet_id || !tanggal_opname || !periode_dari || !periode_sampai || !items?.length) {
    return res.status(400).json({ sukses: false, pesan: 'Data tidak lengkap.' });
  }

  const periode = String(periode_dari).slice(0, 7);
  const rentang = rentangClosingPeriode(periode);
  if (!rentang || periode_dari !== rentang.dari || periode_sampai !== rentang.sampai || tanggal_opname !== rentang.sampai) {
    return res.status(400).json({ sukses: false, kode: 'PERIODE_CLOSING_TIDAK_VALID', pesan: 'Closing outlet harus memakai rentang satu bulan penuh dan tanggal akhir periode.' });
  }
  if (rentang.sampai > tanggalJakartaHariIni()) {
    return res.status(400).json({ sukses: false, kode: 'CLOSING_BELUM_WAKTUNYA', pesan: 'Closing belum dapat dibuat sebelum tanggal akhir periode.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const errorAkses = await pastikanOutletSesuaiGudangCrew(client, req, outlet_id);
    if (errorAkses) {
      await client.query('ROLLBACK');
      return res.status(errorAkses.statusCode).json({ sukses: false, kode: errorAkses.kode, pesan: errorAkses.message });
    }

    const { rows } = await client.query(
      `INSERT INTO opname_outlet (outlet_id, tanggal_opname, periode_dari, periode_sampai, dibuat_oleh, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [outlet_id, tanggal_opname, periode_dari, periode_sampai, dibuat_oleh, status]
    );
    const opname_id = rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO opname_outlet_item (opname_id, item_id, stok_awal, pengambilan, stok_akhir, harga, catatan)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [opname_id, item.item_id, item.stok_awal, item.pengambilan, item.stok_akhir ?? null, item.harga, item.catatan ?? null]
      );
    }

    await client.query('COMMIT');
    res.json({ sukses: true, data: { opname_id, status } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ sukses: false, pesan: 'Closing untuk outlet dan periode ini sudah ada.' });
    }
    next(err);
  } finally {
    client.release();
  }
});

// PUT /opname-outlet/:id/approve
router.put('/:id/approve', requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE opname_outlet
       SET status = 'approved', diapprove_oleh = $1, diapprove_at = now()
       WHERE id = $2 AND status = 'menunggu_approval'
       RETURNING id`,
      [req.user.nama, id]
    );
    if (!rows.length) {
      return res.status(404).json({ sukses: false, pesan: 'Opname tidak ditemukan atau sudah diproses.' });
    }
    res.json({ sukses: true });
  } catch (err) {
    next(err);
  }
});

// PUT /opname-outlet/:id/reject
router.put('/:id/reject', requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { catatan_approval } = req.body;
  if (!catatan_approval) {
    return res.status(400).json({ sukses: false, pesan: 'Catatan penolakan wajib diisi.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE opname_outlet
       SET status = 'ditolak', catatan_approval = $1, diapprove_oleh = $2, diapprove_at = now()
       WHERE id = $3 AND status = 'menunggu_approval'
       RETURNING id`,
      [catatan_approval, req.user.nama, id]
    );
    if (!rows.length) {
      return res.status(404).json({ sukses: false, pesan: 'Opname tidak ditemukan atau sudah diproses.' });
    }
    res.json({ sukses: true });
  } catch (err) {
    next(err);
  }
});

// PUT /opname-outlet/:id/resubmit
router.put('/:id/resubmit', requireAnyAuth, async (req, res, next) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE opname_outlet
       SET status = 'menunggu_approval', catatan_approval = NULL,
           diapprove_oleh = NULL, diapprove_at = NULL
       WHERE id = $1 AND status = 'ditolak'
       RETURNING id`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ sukses: false, pesan: 'Opname tidak ditemukan atau tidak dalam status ditolak.' });
    }
    res.json({ sukses: true });
  } catch (err) {
    next(err);
  }
});

// PUT /opname-outlet/:id
router.put('/:id', requireAnyAuth, async (req, res, next) => {
  const { id } = req.params;
  const { items } = req.body;

  if (!items?.length) {
    return res.status(400).json({ sukses: false, pesan: 'Data items wajib diisi.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, status FROM opname_outlet WHERE id = $1`,
      [id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ sukses: false, pesan: 'Opname tidak ditemukan.' });
    }

    const opname = rows[0];
    const dari_crew = req.device && !req.user?.role?.includes('admin');
    if (dari_crew && opname.status !== 'ditolak') {
      await client.query('ROLLBACK');
      return res.status(403).json({ sukses: false, pesan: 'Opname hanya bisa diedit jika ditolak.' });
    }

    for (const item of items) {
      await client.query(
        `UPDATE opname_outlet_item
         SET stok_akhir = $1, catatan = $2
         WHERE opname_id = $3 AND item_id = $4`,
        [item.stok_akhir ?? null, item.catatan ?? null, id, item.item_id]
      );
    }

    await client.query('COMMIT');
    res.json({ sukses: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
