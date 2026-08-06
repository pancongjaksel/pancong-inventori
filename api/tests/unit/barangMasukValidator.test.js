const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validasiFieldDasar } = require('../../validators/barangMasukValidator');

describe('barangMasukValidator.validasiFieldDasar', () => {
  const inputValid = { itemId: 1, jumlah: 10, satuan: 'Kg', fotoBuktiUrl: 'https://contoh.com/foto.jpg' };

  test('lolos kalau semua field valid', () => {
    assert.doesNotThrow(() => validasiFieldDasar(inputValid));
  });

  test('gagal kalau itemId gak ada', () => {
    assert.throws(() => validasiFieldDasar({ ...inputValid, itemId: undefined }));
  });

  test('gagal kalau jumlah 0 atau negatif', () => {
    assert.throws(() => validasiFieldDasar({ ...inputValid, jumlah: 0 }));
    assert.throws(() => validasiFieldDasar({ ...inputValid, jumlah: -5 }));
  });

  test('gagal kalau satuan kosong/whitespace doang', () => {
    assert.throws(() => validasiFieldDasar({ ...inputValid, satuan: '   ' }));
  });

  test('gagal kalau foto bukti kosong — ini aturan bisnis penting (keputusan Q4, wajib tanpa kecuali)', () => {
    assert.throws(() => validasiFieldDasar({ ...inputValid, fotoBuktiUrl: '' }));
    assert.throws(() => validasiFieldDasar({ ...inputValid, fotoBuktiUrl: undefined }));
  });
});
