const express = require('express');
const { requireAdmin } = require('../middleware/authMiddleware');
const {
  listUsers,
  buatUser,
  updateUser,
  resetPasswordUser,
  tambahAksesGudang,
  hapusAksesGudang,
} = require('../services/userManajemenService');

const router = express.Router();

// Semua endpoint di sini requireAdmin dulu (harus login), tapi validator
// service (validasiPelakuOwner) yang nge-cek lebih ketat: harus role='owner'.
// Dua lapis: middleware pastiin ada sesi valid, validator pastiin levelnya cukup.

/** GET /api/users — daftar semua user + akses gudangnya */
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await listUsers();
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** POST /api/users — buat akun Admin/Owner baru (Owner only) */
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await buatUser(req.body, req.user);
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/users/:id — ubah nama/role/aktif (Owner only) */
router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await updateUser(Number(req.params.id), req.body, req.user);
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** POST /api/users/:id/reset-password — Owner reset password Admin lain */
router.post('/:id/reset-password', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await resetPasswordUser(Number(req.params.id), req.body.passwordBaru, req.user);
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** POST /api/users/:id/akses-gudang — kasih akses gudang ke Admin (Owner only) */
router.post('/:id/akses-gudang', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await tambahAksesGudang(Number(req.params.id), Number(req.body.gudangId), req.user);
    res.status(201).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/users/:id/akses-gudang/:gudangId — cabut akses gudang (Owner only) */
router.delete('/:id/akses-gudang/:gudangId', requireAdmin, async (req, res, next) => {
  try {
    const hasil = await hapusAksesGudang(Number(req.params.id), Number(req.params.gudangId), req.user);
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
