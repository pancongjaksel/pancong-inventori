const { pool } = require('../db/pool');
const { validasiSetReorderPoint } = require('../validators/itemReorderPointValidator');

/** Daftar semua reorder point yang udah dikonfigurasi, buat halaman Manajemen Item & verifikasi. */
async function listReorderPoints() {
  const { rows } = await pool.query(`
    SELECT irp.item_id, irp.gudang_id, irp.reorder_point, g.nama AS nama_gudang, i.kode_barang
    FROM item_reorder_point irp
    JOIN gudang g ON g.id = irp.gudang_id
    JOIN item i ON i.id = irp.item_id
    ORDER BY i.kode_barang, g.nama
  `);
  return rows;
}

/**
 * Set atau hapus reorder point untuk 1 kombinasi item+gudang.
 * reorderPoint = null -> hapus baris (balik ke "belum dikonfigurasi").
 * reorderPoint = angka -> upsert.
 */
async function setReorderPoint(input) {
  const { itemId, gudangId, reorderPoint } = input;
  validasiSetReorderPoint(input);

  if (reorderPoint === null) {
    await pool.query(`DELETE FROM item_reorder_point WHERE item_id = $1 AND gudang_id = $2`, [itemId, gudangId]);
    return { itemId, gudangId, reorderPoint: null };
  }

  const { rows } = await pool.query(
    `INSERT INTO item_reorder_point (item_id, gudang_id, reorder_point, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (item_id, gudang_id) DO UPDATE SET reorder_point = EXCLUDED.reorder_point, updated_at = now()
     RETURNING item_id, gudang_id, reorder_point`,
    [itemId, gudangId, reorderPoint]
  );
  return rows[0];
}

module.exports = { listReorderPoints, setReorderPoint };
