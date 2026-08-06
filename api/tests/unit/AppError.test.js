const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { AppError } = require('../../errors/AppError');

describe('AppError', () => {
  test('default statusCode 400 dan kode VALIDASI_GAGAL kalau gak diisi', () => {
    const err = new AppError('Pesan error');
    assert.equal(err.statusCode, 400);
    assert.equal(err.kode, 'VALIDASI_GAGAL');
    assert.equal(err.message, 'Pesan error');
    assert.equal(err.isAppError, true);
  });

  test('statusCode dan kode custom kepakai kalau diisi', () => {
    const err = new AppError('Gak ketemu', 404, 'DATA_TIDAK_DITEMUKAN');
    assert.equal(err.statusCode, 404);
    assert.equal(err.kode, 'DATA_TIDAK_DITEMUKAN');
  });

  test('instanceof Error (biar bisa ketangkep try/catch biasa)', () => {
    const err = new AppError('test');
    assert.ok(err instanceof Error);
  });
});
