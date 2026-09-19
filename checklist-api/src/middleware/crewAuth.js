// Gate ringan buat endpoint crew/spv: header x-crew-key harus cocok CREW_KEY (atau ADMIN_KEY) di .env
// Beda sama adminAuth — dibagi ke tim crew/spv buat endpoint yang sering dipakai sehari-hari.
function crewAuth(req, res, next) {
  const key = req.header('x-crew-key');
  if (!process.env.CREW_KEY && !process.env.ADMIN_KEY) {
    console.warn('[crewAuth] CREW_KEY belum di-set di .env — semua request ditolak.');
    return res.status(500).json({ error: 'Server belum dikonfigurasi (CREW_KEY kosong)' });
  }
  if (!key || (key !== process.env.CREW_KEY && key !== process.env.ADMIN_KEY)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = crewAuth;
