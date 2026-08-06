const { pool } = require('../db/pool');
const { AppError } = require('../errors/AppError');
const { validasiBuatOutlet, validasiGudangAsal } = require('../validators/outletValidator');

async function buatOutlet(input) {
  const { nama, gudangAsalId } = input;
  validasiBuatOutlet(input);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await validasiGudangAsal(client, gudangAsalId);

    const { rows } = await client.query(
      `INSERT INTO outlet (nama, gudang_asal_id) VALUES ($1, $2) RETURNING id, nama, gudang_asal_id, aktif`,
      [nama.trim(), gudangAsalId]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      throw new AppError(`Outlet dengan nama "${nama}" sudah ada.`, 409, 'NAMA_OUTLET_DUPLIKAT');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function updateOutlet(id, fields) {
  const { nama, gudangAsalId, aktif } = fields;
  if (nama === undefined && gudangAsalId === undefined && aktif === undefined) {
    throw new AppError('Gak ada field yang diubah.', 400, 'TIDAK_ADA_PERUBAHAN');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (gudangAsalId !== undefined) {
      await validasiGudangAsal(client, gudangAsalId);
    }

    const setClauses = [];
    const values = [];
    let i = 1;
    if (nama !== undefined) { setClauses.push(`nama = $${i}`); values.push(nama.trim()); i += 1; }
    if (gudangAsalId !== undefined) { setClauses.push(`gudang_asal_id = $${i}`); values.push(gudangAsalId); i += 1; }
    if (aktif !== undefined) { setClauses.push(`aktif = $${i}`); values.push(aktif); i += 1; }
    values.push(id);

    const { rows } = await client.query(
      `UPDATE outlet SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING id, nama, gudang_asal_id, aktif`,
      values
    );
    if (rows.length === 0) {
      throw new AppError(`Outlet tidak ditemukan (id=${id}).`, 404, 'OUTLET_TIDAK_DITEMUKAN');
    }

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { buatOutlet, updateOutlet };
