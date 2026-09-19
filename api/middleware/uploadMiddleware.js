const multer = require('multer');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');

const FOLDER_UPLOAD = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(FOLDER_UPLOAD, { recursive: true });

const TIPE_FILE_DIIZINKAN = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
// 15MB — client (UploadFoto.jsx) udah resize+compress foto ke JPEG sebelum
// upload, jadi limit ini praktis cuma kena kalau kompresi di-skip (HEIC) atau
// gagal (fallback ke file asli) — buffer aman buat kasus itu, bukan batas normal.
const MAX_UKURAN_BYTES = 15 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FOLDER_UPLOAD),
  filename: (req, file, cb) => {
    const namaAcak = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${namaAcak}${ext}`);
  },
});

function filterTipeFile(req, file, cb) {
  if (!TIPE_FILE_DIIZINKAN.includes(file.mimetype)) {
    return cb(new Error(`Tipe file "${file.mimetype}" gak diizinkan. Cuma boleh JPEG/PNG/WEBP/HEIC.`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter: filterTipeFile,
  limits: { fileSize: MAX_UKURAN_BYTES },
});

module.exports = { upload, FOLDER_UPLOAD };
