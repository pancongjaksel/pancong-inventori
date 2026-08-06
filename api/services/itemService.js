const { pool } = require('../db/pool');
const { AppError } = require('../errors/AppError');
const { validasiBuatItem, validasiUpdateItem, ACCOUNTING_CODE } = require('../validators/itemValidator');

async function buatItem(input) {
  const { kodeBarang, nama, kategori, satuan, gudangDefaultId } = input;
  validasiBuatItem(input);

  try {
    const { rows } = await pool.query(
      `INSERT INTO item (kode_barang, nama, kategori, satuan, accounting_code, gudang_default_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, kode_barang, nama, kategori, satuan, status_aktif`,
      [kodeBarang.trim(), nama.trim(), kategori, satuan.trim(), ACCOUNTING_CODE[kategori], gudangDefaultId ?? null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError(`Kode barang "${kodeBarang}" sudah dipakai item lain.`, 409, 'KODE_BARANG_DUPLIKAT');
    }
    throw err;
  }
}

async function updateItem(id, fields) {
  validasiUpdateItem(fields);

  const kolomMap = {
    nama: 'nama',
    kategori: 'kategori',
    satuan: 'satuan',
    statusAktif: 'status_aktif',
    gudangDefaultId: 'gudang_default_id',
    catatanMigrasi: 'catatan_migrasi',
  };

  const setClauses = [];
  const values = [];
  let i = 1;
  for (const [key, kolom] of Object.entries(kolomMap)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${kolom} = $${i}`);
      values.push(fields[key]);
      i += 1;
    }
  }
  // Kalau kategori diubah, ikutan update accounting_code biar tetep konsisten
  if (fields.kategori !== undefined) {
    setClauses.push(`accounting_code = $${i}`);
    values.push(ACCOUNTING_CODE[fields.kategori]);
    i += 1;
  }
  setClauses.push(`updated_at = now()`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE item SET ${setClauses.join(', ')} WHERE id = $${i}
     RETURNING id, kode_barang, nama, kategori, satuan, status_aktif`,
    values
  );

  if (rows.length === 0) {
    throw new AppError(`Item tidak ditemukan (id=${id}).`, 404, 'ITEM_TIDAK_DITEMUKAN');
  }
  return rows[0];
}

module.exports = { buatItem, updateItem };
