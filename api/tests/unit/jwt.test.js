const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'secret-buat-test-jangan-dipakai-production';
const { buatTokenUser, buatTokenDevice, verifikasiToken } = require('../../utils/jwt');

describe('jwt - token user (Admin/Owner)', () => {
  test('payload yang dibuat cocok pas diverifikasi balik', () => {
    const token = buatTokenUser({ userId: 5, role: 'admin', tokenVersi: 1 });
    const payload = verifikasiToken(token);

    assert.equal(payload.tipe, 'user');
    assert.equal(payload.userId, 5);
    assert.equal(payload.role, 'admin');
    assert.equal(payload.tokenVersi, 1);
  });

  test('token acak ditolak (return null)', () => {
    assert.equal(verifikasiToken('token.acak.ngasal'), null);
  });
});

describe('jwt - token device (Crew)', () => {
  test('payload device cocok pas diverifikasi balik', () => {
    const token = buatTokenDevice({ deviceId: 10, gudangId: 2, tokenVersi: 1 });
    const payload = verifikasiToken(token);

    assert.equal(payload.tipe, 'device');
    assert.equal(payload.deviceId, 10);
    assert.equal(payload.gudangId, 2);
  });

  test('token user gak bisa dipakai seolah-olah token device (tipe beda)', () => {
    const tokenUser = buatTokenUser({ userId: 1, role: 'owner', tokenVersi: 1 });
    const payload = verifikasiToken(tokenUser);
    assert.notEqual(payload.tipe, 'device');
  });
});
