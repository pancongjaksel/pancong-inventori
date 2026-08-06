const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

process.env.DEVICE_QR_SECRET = 'secret-buat-test-jangan-dipakai-production';
const { buatTokenQrGudang, verifikasiTokenQrGudang } = require('../../utils/deviceQrToken');

describe('deviceQrToken', () => {
  test('token yang dibuat bisa diverifikasi balik dan hasilnya gudangId yang sama', () => {
    const token = buatTokenQrGudang(2);
    const hasil = verifikasiTokenQrGudang(token);
    assert.equal(hasil, 2);
  });

  test('token acak/rusak ditolak (return null)', () => {
    assert.equal(verifikasiTokenQrGudang('bukan-token-valid'), null);
    assert.equal(verifikasiTokenQrGudang(''), null);
    assert.equal(verifikasiTokenQrGudang('abc.def'), null);
  });

  test('token yang di-tamper (ganti gudangId tapi signature lama) ditolak', () => {
    const tokenAsli = buatTokenQrGudang(2);
    const [, signatureAsli] = tokenAsli.split('.');
    const payloadPalsu = Buffer.from('99').toString('base64url'); // ngaku gudangId=99
    const tokenPalsu = `${payloadPalsu}.${signatureAsli}`;

    assert.equal(verifikasiTokenQrGudang(tokenPalsu), null);
  });

  test('gudangId non-integer di payload ditolak', () => {
    const crypto = require('node:crypto');
    const payload = 'bukan-angka';
    const signature = crypto.createHmac('sha256', process.env.DEVICE_QR_SECRET).update(payload).digest('hex');
    const token = `${Buffer.from(payload).toString('base64url')}.${signature}`;

    assert.equal(verifikasiTokenQrGudang(token), null);
  });
});
