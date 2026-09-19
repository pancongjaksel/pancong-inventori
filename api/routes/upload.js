const express = require('express');
const { MulterError } = require('multer');
const { requireAnyAuth } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Pesan Indonesia buat kode error bawaan Multer (default-nya english mentah,
// mis. MulterError untuk LIMIT_FILE_SIZE punya message "File too large").
// Kode yang gak ada di sini fallback ke err.message aslinya.
const PESAN_ERROR_MULTER = {
  LIMIT_FILE_SIZE: 'Ukuran file terlalu besar, maksimal 15MB.',
  LIMIT_UNEXPECTED_FILE: 'Field file tidak sesuai, coba upload ulang.',
  LIMIT_FILE_COUNT: 'Cuma boleh upload 1 file.',
  LIMIT_PART_COUNT: 'Terlalu banyak bagian dalam request upload.',
  LIMIT_FIELD_KEY: 'Nama field terlalu panjang.',
  LIMIT_FIELD_VALUE: 'Isi field terlalu panjang.',
  LIMIT_FIELD_COUNT: 'Terlalu banyak field dalam request upload.',
  MISSING_FIELD_NAME: 'Nama field file hilang dari request.',
};

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
// errornya beda dari AppError biasa. MulterError dapat mapping bahasa
// Indonesia (kode bawaannya english mentah); error custom dari filterTipeFile
// di uploadMiddleware.js udah bahasa Indonesia dari sononya, dibiarkan apa
// adanya lewat err.message.
router.use((err, req, res, next) => {
  if (err instanceof MulterError) {
    return res.status(400).json({
      sukses: false,
      kode: 'UPLOAD_GAGAL',
      pesan: PESAN_ERROR_MULTER[err.code] || err.message || 'Gagal upload file.',
    });
  }
  if (err) {
    return res.status(400).json({ sukses: false, kode: 'UPLOAD_GAGAL', pesan: err.message || 'Gagal upload file.' });
  }
  next(err);
});

module.exports = router;
