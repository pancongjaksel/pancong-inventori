/**
 * AppError — error terkontrol yang sengaja dilempar dari validator/service,
 * membawa pesan ramah (Bahasa Indonesia, siap ditampilkan ke user) dan
 * HTTP status yang sesuai. Beda dengan error tak terduga (bug, koneksi DB
 * putus, dll) yang sebaiknya jadi 500 generik di errorHandler.
 */
class AppError extends Error {
  /**
   * @param {string} message - pesan ramah untuk user, Bahasa Indonesia
   * @param {number} statusCode - HTTP status, default 400 (Bad Request)
   * @param {string} [kode] - kode error mesin-terbaca, mis. 'OUTLET_TIDAK_SESUAI_GUDANG'
   */
  constructor(message, statusCode = 400, kode = 'VALIDASI_GAGAL') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.kode = kode;
    this.isAppError = true; // penanda buat errorHandler
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { AppError };
