const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { AppError } = require('../../errors/AppError');
const { validasiSetReorderPoint } = require('../../validators/itemReorderPointValidator');

describe('itemReorderPointValidator.validasiSetReorderPoint', () => {
  test('lolos kalau itemId, gudangId, dan reorderPoint angka valid', () => {
    assert.doesNotThrow(() => validasiSetReorderPoint({ itemId: 1, gudangId: 2, reorderPoint: 10 }));
  });

  test('reorderPoint null (buat hapus/reset) diizinkan', () => {
    assert.doesNotThrow(() => validasiSetReorderPoint({ itemId: 1, gudangId: 2, reorderPoint: null }));
  });

  test('gagal kalau itemId bukan angka', () => {
    assert.throws(() => validasiSetReorderPoint({ itemId: 'x', gudangId: 2, reorderPoint: 10 }), AppError);
  });

  test('gagal kalau gudangId gak diisi', () => {
    assert.throws(() => validasiSetReorderPoint({ itemId: 1, reorderPoint: 10 }), AppError);
  });

  test('gagal kalau reorderPoint negatif', () => {
    assert.throws(() => validasiSetReorderPoint({ itemId: 1, gudangId: 2, reorderPoint: -5 }), AppError);
  });
});
