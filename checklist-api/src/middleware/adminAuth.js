// Gate sederhana buat endpoint admin: header x-admin-key harus cocok ADMIN_KEY di .env
// Bukan sistem login penuh — cukup buat cegah orang random hit endpoint tambah/edit outlet & item.
function adminAuth(req, res, next) {
  const key = req.header('x-admin-key');
  if (!process.env.ADMIN_KEY) {
    console.warn('[adminAuth] ADMIN_KEY belum di-set di .env — semua request admin ditolak.');
    return res.status(500).json({ error: 'Server belum dikonfigurasi (ADMIN_KEY kosong)' });
  }
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = adminAuth;
