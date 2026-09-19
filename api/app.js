require('dotenv').config();
const express = require('express');
const path = require('node:path');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRouter = require('./routes/auth');
const sesiPengambilanCrewRouter = require('./routes/sesiPengambilanCrew');
const barangMasukRouter = require('./routes/barangMasuk');
const barangMasukNotaRouter = require('./routes/barangMasukNota');
const transferGudangRouter = require('./routes/transferGudang');
const koreksiTransaksiRouter = require('./routes/koreksiTransaksi');
const stokOpnameRouter = require('./routes/stokOpname');
const deviceGudangRouter = require('./routes/deviceGudang');
const deviceAdminGudangRouter = require('./routes/deviceAdminGudang');
const masterRouter = require('./routes/master');
const laporanRouter = require('./routes/laporan');
const usersRouter = require('./routes/users');
const uploadRouter = require('./routes/upload');
const opnameOutletRouter = require('./routes/opnameOutlet');
const notifikasiRouter = require('./routes/notifikasi');
const dashboardRouter = require('./routes/dashboard');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// FRONTEND_URL boleh diisi lebih dari satu, dipisah koma — berguna pas dev
// karena Vite kadang otomatis pindah port (5173 -> 5174 dst) kalau port
// defaultnya lagi kepakai proses lain.
function normalisasiOrigin(origin) {
  try {
    // URL.origin menganggap :443 HTTPS dan :80 HTTP sebagai port bawaan,
    // jadi "https://host" dan "https://host:443" dianggap origin yang sama.
    return new URL(origin).origin;
  } catch {
    return origin;
  }
}

const originYangDiizinkan = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => normalisasiOrigin(s.trim()));

app.use(cors({
  origin(origin, callback) {
    // origin undefined = request tanpa header Origin (mis. curl, Postman) — izinkan
    if (!origin || originYangDiizinkan.includes(normalisasiOrigin(origin))) {
      callback(null, true);
    } else {
      callback(new Error(`Origin "${origin}" tidak diizinkan CORS. Tambahkan ke FRONTEND_URL di .env.`));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/sesi-pengambilan-crew', sesiPengambilanCrewRouter);
app.use('/api/barang-masuk', barangMasukRouter);
app.use('/api/barang-masuk-nota', barangMasukNotaRouter);
app.use('/api/transfer-gudang', transferGudangRouter);
app.use('/api/koreksi-transaksi', koreksiTransaksiRouter);
app.use('/api/stok-opname', stokOpnameRouter);
app.use('/api/device-gudang', deviceGudangRouter);
app.use('/api/device-admin-gudang', deviceAdminGudangRouter);
app.use('/api/master', masterRouter);
app.use('/api/laporan', laporanRouter);
app.use('/api/users', usersRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/opname-outlet', opnameOutletRouter);
app.use('/api/notifikasi', notifikasiRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // sajikan foto bukti yang udah diupload
// ...route lain (produksi/BOM Fase 2, master data CRUD) dipasang di sini,
// ikut pola yang sama: controller tipis -> service -> validator, dan pasang
// requireAdmin/requireDevice sesuai siapa yang boleh akses.

// PENTING: errorHandler harus dipasang PALING TERAKHIR, setelah semua route.
app.use(errorHandler);

module.exports = app;
