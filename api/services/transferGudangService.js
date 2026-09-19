const { pool } = require('../db/pool');
const { beginIdempotent, finishIdempotent } = require('./idempotencyService');
const { validasiSebelumKirim, validasiSebelumTerima } = require('../validators/transferGudangValidator');

/**
 * Langkah 1/2 — Kirim (5.4). INSERT ke transfer_gudang dengan status default
 * 'dikirim'; trigger trg_transfer_ke_ledger otomatis kurangi stok gudang asal.
 */
async function kirimTransfer(input) {
  const { itemId, gudangAsalId, gudangTujuanId, jumlah, fotoBuktiKirimUrl, dikirimOlehUserId, dikirimOlehRole } = input;
  const requiresApproval = dikirimOlehRole === 'admin_gudang';

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
         (item_id, gudang_asal_id, gudang_tujuan_id, jumlah, foto_bukti_kirim_url, dikirim_oleh_user_id, sumber_transaksi, dibuat_oleh_role, dibuat_oleh_user_id, status, status_verifikasi)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $6, $9, $10)
       RETURNING id, status`,
      [itemId, gudangAsalId, gudangTujuanId, jumlah, fotoBuktiKirimUrl, dikirimOlehUserId, dikirimOlehRole || 'admin', dikirimOlehRole || 'admin', requiresApproval ? 'menunggu_approval' : 'dikirim', requiresApproval ? 'menunggu' : 'approved']
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
  const { id, diterimaOlehUserId, diterimaOlehRole, fotoBuktiTerimaUrl } = input;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await validasiSebelumTerima(client, { id, diterimaOlehUserId, diterimaOlehRole, fotoBuktiTerimaUrl });

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

async function verifikasiTransferOnce({ id, ownerUserId, aksi, catatan, bukti, idempotencyKey }) {
  if (!idempotencyKey) throw Object.assign(new Error('Idempotency-Key wajib untuk verifikasi transfer.'), { statusCode: 400 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    const idem = await beginIdempotent(client, { key: idempotencyKey, actorType: 'user', actorId: ownerUserId, endpoint: `/api/transfer-gudang/${id}/verifikasi`, body: { aksi, catatan, bukti } });
    if (idem.duplicate) { await client.query('ROLLBACK'); return idem.response_body; }
    const { rows } = await client.query('SELECT * FROM transfer_gudang WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length) throw Object.assign(new Error('Transfer tidak ditemukan.'), { statusCode: 404 });
    const current = rows[0];
    if (current.status !== 'menunggu_approval' || current.status_verifikasi !== 'menunggu') throw Object.assign(new Error('Transfer tidak sedang menunggu persetujuan Owner.'), { statusCode: 409 });
    if (!['approve','reject'].includes(aksi)) throw Object.assign(new Error('Aksi verifikasi tidak valid.'), { statusCode: 400 });
    if (aksi === 'approve') {
      const locks = await client.query('SELECT id FROM gudang WHERE id IN ($1,$2) ORDER BY id FOR UPDATE', [current.gudang_asal_id, current.gudang_tujuan_id]);
      if (locks.rowCount !== 2) throw Object.assign(new Error('Gudang transfer tidak ditemukan.'), { statusCode: 409 });
      const stock = await client.query('SELECT stok_saat_ini FROM v_stok_gudang_saat_ini WHERE gudang_id=$1 AND item_id=$2', [current.gudang_asal_id, current.item_id]);
      if (Number(stock.rows[0]?.stok_saat_ini || 0) < Number(current.jumlah)) throw Object.assign(new Error('Stok tidak cukup saat approval Owner.'), { statusCode: 409, code: 'STOK_TIDAK_CUKUP' });
    }
    const nextStatus = aksi === 'approve' ? 'dikirim' : 'ditolak';
    const nextVerification = aksi === 'approve' ? 'approved' : 'rejected';
    await client.query(`UPDATE transfer_gudang SET status=$2,status_verifikasi=$3,versi_transaksi=versi_transaksi+1,verifikasi_terakhir_at=now(),verifikasi_terakhir_oleh_user_id=$4,verifikasi_terakhir_oleh_role='owner',catatan_verifikasi=$5,bukti_verifikasi_ref=$6 WHERE id=$1`, [id,nextStatus,nextVerification,ownerUserId,catatan||null,bukti||null]);
    await client.query(`INSERT INTO transaksi_verifikasi (transaksi_tipe,transaksi_id,versi_transaksi,aksi_verifikasi,dibuat_oleh_user_id,dibuat_oleh_role,diverifikasi_oleh_user_id,diverifikasi_oleh_role,alasan,bukti_nota_ref,nilai_sebelum,nilai_sesudah) VALUES ('transfer_gudang',$1,$2,$3,$4,$5,$6,'owner',$7,$8,$9::jsonb,$10::jsonb)`, [id,current.versi_transaksi+1,aksi,current.dibuat_oleh_user_id||current.dikirim_oleh_user_id,current.dibuat_oleh_role||current.sumber_transaksi||'legacy',ownerUserId,catatan||null,bukti||null,JSON.stringify({status:current.status,status_verifikasi:current.status_verifikasi}),JSON.stringify({status:nextStatus,status_verifikasi:nextVerification})]);
    const response = { id, status: nextStatus, statusVerifikasi: nextVerification };
    await finishIdempotent(client, { key: idempotencyKey, actorType: 'user', actorId: ownerUserId, endpoint: `/api/transfer-gudang/${id}/verifikasi`, status: 200, body: response });
    await client.query('COMMIT'); return response;
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}


async function verifikasiTransfer(input) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await verifikasiTransferOnce(input);
    } catch (err) {
      const sqlState = err.code || err.sqlState;
      if (sqlState !== '40001' || attempt === maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 25 * (2 ** (attempt - 1))));
    }
  }
  throw new Error('Approval transfer gagal setelah retry.');
}

module.exports = { kirimTransfer, terimaTransfer, verifikasiTransfer };
