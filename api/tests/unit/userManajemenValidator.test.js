const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validasiPelakuOwner, validasiBuatUser } = require('../../validators/userManajemenValidator');

describe('userManajemenValidator.validasiPelakuOwner', () => {
  test('lolos kalau pelaku role owner', () => {
    assert.doesNotThrow(() => validasiPelakuOwner({ role: 'owner' }));
  });

  test('gagal kalau pelaku role admin (bukan owner)', () => {
    assert.throws(() => validasiPelakuOwner({ role: 'admin' }));
  });
});

describe('userManajemenValidator.validasiBuatUser', () => {
  const inputValid = { nama: 'Test User', email: 'test@example.com', password: 'password123', role: 'admin' };

  test('lolos kalau semua field valid', () => {
    assert.doesNotThrow(() => validasiBuatUser(inputValid));
  });

  test('gagal kalau role bukan admin/owner', () => {
    assert.throws(() => validasiBuatUser({ ...inputValid, role: 'crew' }));
  });

  test('gagal kalau password kurang dari 8 karakter', () => {
    assert.throws(() => validasiBuatUser({ ...inputValid, password: 'pendek' }));
  });

  test('gagal kalau email kosong', () => {
    assert.throws(() => validasiBuatUser({ ...inputValid, email: undefined }));
  });
});
