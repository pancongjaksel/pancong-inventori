const { rateLimit } = require('express-rate-limit');

function responsTerlaluBanyak(req, res) {
  res.status(429).json({
    sukses: false,
    kode: 'TERLALU_BANYAK_PERCOBAAN',
    pesan: 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.',
  });
}

const opsiDasar = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: responsTerlaluBanyak,
};

// Password hash sengaja mahal; limiter mencegah brute force sekaligus beban
// bcrypt berlebihan dari satu alamat IP.
const batasiLogin = rateLimit({
  ...opsiDasar,
  limit: 10,
  skipSuccessfulRequests: true,
});

// Setup device tidak membutuhkan akun login, sehingga perlu perlindungan
// sendiri walau QR token tetap menjadi kontrol akses utama.
const batasiSetupDevice = rateLimit({
  ...opsiDasar,
  limit: 20,
  skipSuccessfulRequests: true,
});

module.exports = { batasiLogin, batasiSetupDevice };
