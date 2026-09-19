const express = require('express');
const { requireAdmin, requireDevice, requireAdminOrGudang } = require('../middleware/authMiddleware');
const {
  buatNotaAdmin,
  buatNotaAdminGudang,
  buatNotaCrew,
  verifikasiNota,
  listNota,
  getNota,
  jumlahNotaMenunggu,
} = require('../services/barangMasukNotaService');

const router = express.Router();

/** GET /api/barang-masuk-nota?status=menunggu */
router.get('/', requireAdminOrGudang, async (req, res, next) => {
  try {
    const status = req.query.status || 'menunggu';
    const hasil = await listNota(status);
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/barang-masuk-nota/jumlah-menunggu — badge count nav "Verifikasi".
 * requireAdminOrGudang (bukan requireAdmin) — sama kayak GET / di atas, karena
 * halaman Verifikasi (dan badge-nya) juga bisa diakses sesi device Admin Gudang.
 */
router.get('/jumlah-menunggu', requireAdminOrGudang, async (req, res, next) => {
  try {
    const jumlah = await jumlahNotaMenunggu();
    res.status(200).json({ sukses: true, data: { jumlah } });
  } catch (err) {
    next(err);
  }
});

/** GET /api/barang-masuk-nota/:id — detail satu nota */
router.get('/:id', requireAdminOrGudang, async (req, res, next) => {
  try {
    const nota = await getNota(Number(req.params.id));
    if (!nota) return res.status(404).json({ sukses: false, pesan: 'Nota tidak ditemukan.' });
    res.status(200).json({ sukses: true, data: nota });
  } catch (err) {
    next(err);
  }
});

/** POST /api/barang-masuk-nota/admin — Admin, 1 nota banyak item, langsung terverifikasi */
router.post('/admin', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await buatNotaAdmin({ ...req.body, adminUserId: req.user.id, idempotencyKey: req.get('Idempotency-Key') });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/barang-masuk-nota/admin-gudang — Device Admin Gudang, 1 nota banyak
 * item, status "menunggu" (butuh verifikasi admin/owner — siapa yang input
 * gak boleh sekaligus approve). gudangId dipilih dari form (admin_gudang gak
 * gudang-scoped di token), bukan dari req.device kayak jalur crew.
 */
router.post('/admin-gudang', requireAdminOrGudang, async (req, res, next) => {
  try {
    const hasil = await buatNotaAdminGudang({ ...req.body, adminGudangUserId: req.user.id, idempotencyKey: req.get('Idempotency-Key') });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** POST /api/barang-masuk-nota/crew — Crew, 1 nota banyak item, status "menunggu" */
router.post('/crew', requireDevice, async (req, res, next) => {
  try {
    const hasil = await buatNotaCrew({ ...req.body, gudangId: req.device.gudangId, namaCrewInput: req.device.nama, crewId: req.device.crewId, crewSessionId: req.device.crewSessionId, idempotencyKey: req.get('Idempotency-Key') });
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/barang-masuk-nota/:id/verifikasi */
router.patch('/:id/verifikasi', requireAdminOrGudang, async (req, res, next) => {
  try {
    const hasil = await verifikasiNota({ id: Number(req.params.id), ...req.body, adminUserId: req.user.id, adminUserRole: req.user.role, idempotencyKey: req.get('Idempotency-Key') });
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
