const { AppError } = require('../errors/AppError');

function validasiSetReorderPoint({ itemId, gudangId, reorderPoint }) {
  if (!Number.isInteger(itemId) || !Number.isInteger(gudangId)) {
    throw new AppError('itemId dan gudangId wajib diisi (angka).', 400, 'FIELD_KOSONG');
  }
  if (reorderPoint !== null && (typeof reorderPoint !== 'number' || Number.isNaN(reorderPoint) || reorderPoint < 0)) {
    throw new AppError('Reorder point harus angka >= 0, atau null buat hapus.', 400, 'REORDER_POINT_TIDAK_VALID');
  }
}

module.exports = { validasiSetReorderPoint };
