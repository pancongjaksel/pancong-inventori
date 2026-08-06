const { AppError } = require('../errors/AppError');

const KATEGORI_VALID = ['Bahan Adonan', 'Topping', 'Kemasan', 'Kebersihan'];
const ACCOUNTING_CODE = {
  'Bahan Adonan': '5-1101',
  Topping: '5-1102',
  Kemasan: '5-1103',
  Kebersihan: '5-1104',
};

function validasiBuatItem({ kodeBarang, nama, kategori, satuan }) {
  if (!kodeBarang || !nama || !satuan) {
    throw new AppError('Kode barang, nama, dan satuan wajib diisi.', 400, 'FIELD_KOSONG');
  }
  if (!KATEGORI_VALID.includes(kategori)) {
    throw new AppError(`Kategori harus salah satu dari: ${KATEGORI_VALID.join(', ')}.`, 400, 'KATEGORI_TIDAK_VALID');
  }
}

function validasiUpdateItem(fields) {
  const adaField = ['nama', 'kategori', 'satuan', 'statusAktif', 'reorderPoint', 'gudangDefaultId', 'catatanMigrasi'].some(
    (k) => fields[k] !== undefined
  );
  if (!adaField) {
    throw new AppError('Gak ada field yang diubah.', 400, 'TIDAK_ADA_PERUBAHAN');
  }
  if (fields.kategori !== undefined && !KATEGORI_VALID.includes(fields.kategori)) {
    throw new AppError(`Kategori harus salah satu dari: ${KATEGORI_VALID.join(', ')}.`, 400, 'KATEGORI_TIDAK_VALID');
  }
  if (fields.reorderPoint !== undefined && fields.reorderPoint !== null && fields.reorderPoint < 0) {
    throw new AppError('Reorder point gak boleh negatif.', 400, 'REORDER_POINT_TIDAK_VALID');
  }
}

module.exports = { validasiBuatItem, validasiUpdateItem, ACCOUNTING_CODE, KATEGORI_VALID };
