const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  validasiUpdateHargaNota,
} = require('../../validators/barangMasukNotaValidator');

describe('validasiUpdateHargaNota', () => {
  test('menerima harga positif pada baris berbeda', () => {
    assert.doesNotThrow(() => validasiUpdateHargaNota({
      items: [{ itemRowId: 1, hargaBeli: 12500 }, { itemRowId: 2, hargaBeli: '25000.50' }],
    }));
  });

  test('menolak harga nol, negatif, atau bukan angka', () => {
    for (const hargaBeli of [0, -1, 'bukan-angka']) {
      assert.throws(
        () => validasiUpdateHargaNota({ items: [{ itemRowId: 1, hargaBeli }] }),
        { message: 'Harga beli setiap barang harus lebih dari 0.' },
      );
    }
  });

  test('menolak baris barang yang dikirim dua kali', () => {
    assert.throws(() => validasiUpdateHargaNota({
      items: [{ itemRowId: 1, hargaBeli: 1000 }, { itemRowId: 1, hargaBeli: 2000 }],
    }), { message: 'Satu baris barang hanya boleh diubah sekali.' });
  });
});
