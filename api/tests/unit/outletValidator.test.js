const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validasiBuatOutlet } = require('../../validators/outletValidator');

describe('outletValidator.validasiBuatOutlet', () => {
  test('lolos kalau nama dan gudangAsalId diisi', () => {
    assert.doesNotThrow(() => validasiBuatOutlet({ nama: 'Outlet Baru', gudangAsalId: 2 }));
  });

  test('gagal kalau nama kosong', () => {
    assert.throws(() => validasiBuatOutlet({ gudangAsalId: 2 }));
  });

  test('gagal kalau gudangAsalId kosong', () => {
    assert.throws(() => validasiBuatOutlet({ nama: 'Outlet Baru' }));
  });
});

// Catatan: validasiGudangAsal() gak dites di sini karena butuh koneksi DB
// (query ke tabel gudang) — dites di tests/integration/outlet.test.js.
