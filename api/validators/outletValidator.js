const { AppError } = require('../errors/AppError');

function validasiBuatOutlet({ nama, gudangAsalId }) {
  if (!nama || !gudangAsalId) {
    throw new AppError('Nama outlet dan gudang asal wajib diisi.', 400, 'FIELD_KOSONG');
  }
}

async function validasiGudangAsal(client, gudangAsalId) {
  const { rows } = await client.query('SELECT id, nama, tipe FROM gudang WHERE id = $1', [gudangAsalId]);
  const gudang = rows[0];
  if (!gudang) {
    throw new AppError(`Gudang tidak ditemukan (id=${gudangAsalId}).`, 404, 'GUDANG_TIDAK_DITEMUKAN');
  }
  if (gudang.tipe === 'hub_admin_only') {
    throw new AppError(
      `Gudang "${gudang.nama}" adalah hub admin-only, gak bisa jadi gudang asal outlet (outlet cuma dilayani gudang tipe serving).`,
      400,
      'GUDANG_TIDAK_BISA_MELAYANI_OUTLET'
    );
  }
  return gudang;
}

module.exports = { validasiBuatOutlet, validasiGudangAsal };
