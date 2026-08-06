const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { AppError } = require('../../errors/AppError');
const { validasiBuatItem, validasiUpdateItem } = require('../../validators/itemValidator');

describe('itemValidator.validasiBuatItem', () => {
  test('lolos kalau semua field wajib diisi dan kategori valid', () => {
    assert.doesNotThrow(() =>
      validasiBuatItem({ kodeBarang: 'BA-099', nama: 'Test Item', kategori: 'Bahan Adonan', satuan: 'Kg' })
    );
  });

  test('gagal kalau kodeBarang kosong', () => {
    assert.throws(
      () => validasiBuatItem({ nama: 'Test', kategori: 'Topping', satuan: 'Kg' }),
      AppError
    );
  });

  test('gagal kalau kategori bukan salah satu dari 4 kategori valid', () => {
    assert.throws(() =>
      validasiBuatItem({ kodeBarang: 'X-001', nama: 'Test', kategori: 'Kategori Ngasal', satuan: 'Pcs' })
    );
  });
});

describe('itemValidator.validasiUpdateItem', () => {
  test('gagal kalau gak ada field yang diubah sama sekali', () => {
    assert.throws(() => validasiUpdateItem({}));
  });

  test('lolos kalau minimal 1 field valid diisi', () => {
    assert.doesNotThrow(() => validasiUpdateItem({ statusAktif: false }));
  });

  test('gagal kalau kategori baru bukan salah satu yang valid', () => {
    assert.throws(() => validasiUpdateItem({ kategori: 'Ngasal' }));
  });
});
