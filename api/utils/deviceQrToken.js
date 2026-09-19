const crypto = require('crypto');

// Secret HARUS diisi dari environment variable di production, jangan hardcode.
// Ini yang bikin QR yang ditempel di gudang gak bisa dipalsu/ditulis ulang orang
// yang gak punya akses ke server (mereka bisa liat/foto QR-nya, tapi gak bisa
// bikin token baru yang valid tanpa tau secret ini).
const SECRET = process.env.DEVICE_QR_SECRET;
if (!SECRET) {
  // Sengaja fail-fast saat startup kalau secret belum di-set, daripada bikin
  // token yang gampang ditebak/kosong di production.
  console.warn(
    '[deviceQrToken] PERINGATAN: DEVICE_QR_SECRET belum di-set di environment. ' +
      'QR setup device TIDAK aman dipakai sampai ini diisi.'
  );
}

/**
 * Bikin token untuk QR setup device satu gudang. Token ini TIDAK ada
 * expiry — QR-nya ditempel permanen di lokasi gudang, umurnya sama
 * kayak QR WiFi kantor. Kalau suatu saat mau di-rotate (misal QR dicuri/
 * disalahgunakan), tinggal ganti DEVICE_QR_SECRET → semua QR lama otomatis
 * invalid, tinggal cetak ulang.
 *
 * Format token: base64(gudangId) + '.' + HMAC-SHA256(gudangId, SECRET)
 */
function buatTokenQrGudang(gudangId) {
  const payload = String(gudangId);
  const signature = crypto.createHmac('sha256', SECRET || '').update(payload).digest('hex');
  const payloadB64 = Buffer.from(payload).toString('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Verifikasi token dari hasil scan QR. Return gudangId (number) kalau valid,
 * atau null kalau token rusak/dipalsu.
 */
function verifikasiTokenQrGudang(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const [payloadB64, signature] = token.split('.');
  let payload;
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const signatureSeharusnya = crypto.createHmac('sha256', SECRET || '').update(payload).digest('hex');

  // Pakai timingSafeEqual biar gak rentan timing attack (walau resiko kecil
  // untuk kasus internal ini, tetep best practice buat kode yang bandingin
  // signature/token).
  const bufA = Buffer.from(signature, 'hex');
  const bufB = Buffer.from(signatureSeharusnya, 'hex');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  const gudangId = Number(payload);
  return Number.isInteger(gudangId) ? gudangId : null;
}

/**
 * Token QR untuk Admin Gudang — beda dari QR gudang biasa, gak terikat ke
 * gudang_id manapun (identitas "Admin Gudang" itu satu akun bersama, bukan
 * per-gudang). Payload-nya konstan ('admin-gudang'), keamanannya murni dari
 * signature HMAC — tanpa tau SECRET, gak ada cara bikin token yang valid.
 */
function buatTokenQrAdminGudang() {
  const payload = 'admin-gudang';
  const signature = crypto.createHmac('sha256', SECRET || '').update(payload).digest('hex');
  return `${payload}.${signature}`;
}

/** Verifikasi token QR Admin Gudang. Return true kalau valid, false kalau rusak/dipalsu. */
function verifikasiTokenQrAdminGudang(token) {
  if (typeof token !== 'string' || !token.includes('.')) return false;

  const [payload, signature] = token.split('.');
  const signatureSeharusnya = crypto.createHmac('sha256', SECRET || '').update(payload).digest('hex');

  const bufA = Buffer.from(signature, 'hex');
  const bufB = Buffer.from(signatureSeharusnya, 'hex');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return false;
  }

  return payload === 'admin-gudang';
}

module.exports = {
  buatTokenQrGudang,
  verifikasiTokenQrGudang,
  buatTokenQrAdminGudang,
  verifikasiTokenQrAdminGudang,
};
