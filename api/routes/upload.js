const express = require('express');
const { requireAnyAuth } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

/**
 * POST /api/upload — multipart/form-data, field name 'foto'
 * Response: { url: '/uploads/xxx.jpg' } — url RELATIF, frontend/caller yang
 * gabungin sama base URL API kalau perlu tampilin/buka di tab baru.
 */
router.post('/', requireAnyAuth, upload.single('foto'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ sukses: false, kode: 'FILE_KOSONG', pesan: 'Gak ada file yang diupload.' });
  }
  res.status(201).json({ sukses: true, data: { url: `/uploads/${req.file.filename}` } });
});

// Multer melempar error (tipe file salah, terlalu besar, dll) SEBELUM masuk
// ke handler di atas — perlu error handler khusus di sini karena bentuk
// errornya beda dari AppError biasa.
router.use((err, req, res, next) => {
  if (err instanceof require('multer').MulterError || err) {
    return res.status(400).json({ sukses: false, kode: 'UPLOAD_GAGAL', pesan: err.message || 'Gagal upload file.' });
  }
  next(err);
});

module.exports = router;
