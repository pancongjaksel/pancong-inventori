const { pool } = require('../db/pool');
const { validasiSebelumKirim, validasiSebelumTerima } = require('../validators/transferGudangValidator');

/**
 * Langkah 1/2 — Kirim (5.4). INSERT ke transfer_gudang dengan status default
 * 'dikirim'; trigger trg_transfer_ke_ledger otomatis kurangi stok gudang asal.
 */
async function kirimTransfer(input) {
  const { itemId, gudangAsalId, gudangTujuanId, jumlah, fotoBuktiKirimUrl, dikirimOlehUserId } = input;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await validasiSebelumKirim(client, {
      itemId,
      gudangAsalId,
      gudangTujuanId,
      jumlah,
      fotoBuktiKirimUrl,
      dikirimOlehUserId,
    });

    const { rows } = await client.query(
      `INSERT INTO transfer_gudang
         (item_id, gudang_asal_id, gudang_tujuan_id, jumlah, foto_bukti_kirim_url, dikirim_oleh_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status`,
      [itemId, gudangAsalId, gudangTujuanId, jumlah, fotoBuktiKirimUrl, dikirimOlehUserId]
    );

    await client.query('COMMIT');
    return rows[0]; // { id, status: 'dikirim' }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Langkah 2/2 — Terima (5.4). UPDATE status ke 'diterima'; trigger
 * trg_transfer_ke_ledger otomatis nambah stok gudang tujuan.
 */
async function terimaTransfer(input) {
  const { id, diterimaOlehUserId, fotoBuktiTerimaUrl } = input;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await validasiSebelumTerima(client, { id, diterimaOlehUserId, fotoBuktiTerimaUrl });

    await client.query(
      `UPDATE transfer_gudang
       SET status = 'diterima',
           diterima_oleh_user_id = $2,
           foto_bukti_terima_url = $3,
           tanggal_terima = now()
       WHERE id = $1`,
      [id, diterimaOlehUserId, fotoBuktiTerimaUrl]
    );

    await client.query('COMMIT');
    return { id, status: 'diterima' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { kirimTransfer, terimaTransfer };
