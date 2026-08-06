/**
 * Error handler terpusat. Pasang PALING TERAKHIR di app.use() setelah semua route.
 *
 * Urutan penanganan:
 * 1. AppError (dari validator/service kita sendiri) -> sudah punya pesan ramah,
 *    tinggal diteruskan apa adanya.
 * 2. Error Postgres dari RAISE EXCEPTION di trigger (kode 'P0001') -> ini
 *    JARANG kejadian kalau validasi app layer udah bener, tapi tetap kita
 *    relay pesannya (trigger kita udah nulis pesan Bahasa Indonesia yang jelas,
 *    lihat skema_database_inventori_pancong_jaksel.sql) dengan status 400,
 *    ditandai supaya tim tau ini "lolos" dari validasi app layer -> perlu dicek.
 * 3. Error Postgres constraint umum (unique violation, FK violation, dll)
 *    -> pesan generik ramah, detail teknis cuma di-log server-side.
 * 4. Selain itu -> 500 generik, detail asli cuma di-log, TIDAK dikirim ke client.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // 1) AppError — error bisnis yang sengaja dilempar
  if (err.isAppError) {
    return res.status(err.statusCode).json({
      sukses: false,
      kode: err.kode,
      pesan: err.message,
    });
  }

  // 2) RAISE EXCEPTION dari trigger DB (kode P0001)
  //    Kalau ini kejadian, berarti ada jalur insert yang LOLOS validasi app
  //    layer (bug di service, atau akses langsung ke DB) — log sebagai warning
  //    supaya ketahuan dan validasi app layer-nya dilengkapi.
  if (err.code === 'P0001') {
    console.warn(
      '[errorHandler] Trigger DB menangkap pelanggaran yang harusnya sudah ' +
        'dicegah di app layer. Cek validator terkait. Detail:',
      err.message
    );
    return res.status(400).json({
      sukses: false,
      kode: 'VALIDASI_DB_GAGAL',
      pesan: err.message, // trigger kita nulis pesan yang sudah ramah & Indonesia
    });
  }

  // 3) Constraint umum Postgres — pesan generik, jangan bocorkan detail teknis
  const PESAN_KODE_PG = {
    '23505': 'Data ini sudah ada sebelumnya (duplikat).',
    '23503': 'Data terkait tidak ditemukan atau tidak valid (foreign key).',
    '23514': 'Data tidak memenuhi aturan validasi (check constraint).',
    '22P02': 'Format data yang dikirim tidak sesuai.',
  };
  if (err.code && PESAN_KODE_PG[err.code]) {
    console.error('[errorHandler] Postgres constraint error:', err.code, err.message);
    return res.status(400).json({
      sukses: false,
      kode: 'DATA_TIDAK_VALID',
      pesan: PESAN_KODE_PG[err.code],
    });
  }

  // 4) Error tak terduga — log lengkap di server, kirim pesan generik ke client
  console.error('[errorHandler] Unexpected error:', err);
  return res.status(500).json({
    sukses: false,
    kode: 'SERVER_ERROR',
    pesan: 'Terjadi kesalahan di server. Coba lagi beberapa saat, atau hubungi admin kalau berulang.',
  });
}

module.exports = { errorHandler };
