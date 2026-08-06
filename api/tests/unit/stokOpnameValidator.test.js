const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validasiFieldDasar } = require('../../validators/stokOpnameValidator');

describe('stokOpnameValidator.validasiFieldDasar', () => {
  const inputValid = { itemId: 1, stokFisik: 50, periode: '2026-08' };

  test('lolos kalau semua field valid', () => {
    assert.doesNotThrow(() => validasiFieldDasar(inputValid));
  });

  test('gagal kalau stokFisik negatif', () => {
    assert.throws(() => validasiFieldDasar({ ...inputValid, stokFisik: -1 }));
  });

  test('stokFisik 0 diizinkan (barang emang bisa habis)', () => {
    assert.doesNotThrow(() => validasiFieldDasar({ ...inputValid, stokFisik: 0 }));
  });

  test('gagal kalau format periode salah (harus YYYY-MM)', () => {
    assert.throws(() => validasiFieldDasar({ ...inputValid, periode: '08-2026' }));
    assert.throws(() => validasiFieldDasar({ ...inputValid, periode: '2026-13' })); // bulan 13 gak valid
    assert.throws(() => validasiFieldDasar({ ...inputValid, periode: '2026' }));
  });

  test('periode bulan 01 dan 12 (batas awal/akhir) diizinkan', () => {
    assert.doesNotThrow(() => validasiFieldDasar({ ...inputValid, periode: '2026-01' }));
    assert.doesNotThrow(() => validasiFieldDasar({ ...inputValid, periode: '2026-12' }));
  });
});
