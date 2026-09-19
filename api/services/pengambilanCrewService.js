const { pool } = require('../db/pool');
const {
  validasiOutletTujuan,
  validasiLaranganBahanAdonan,
  validasiFieldDasar,
} = require('../validators/pengambilanCrewValidator');
const { onPengambilanDibuat } = require('./aktivitasPengambilanService');
const { beginIdempotent, finishIdempotent } = require('./idempotencyService');

/**
 * Buat sesi pengambilan crew (5.2 di PRD): 1 sesi bisa banyak item.
 * Validasi dijalankan DULU (di app layer, pesan ramah), baru insert.
 * Trigger DB (trg_validasi_outlet_tujuan, trg_validasi_larangan_bahan_adonan)
 * tetap ada sebagai pengaman kedua kalau ada jalur lain yang nulis ke tabel
 * ini di luar service ini (mis. migrasi data, akses langsung, dll).
 *
 * @param {object} input
 * @param {string} input.namaCrew
 * @param {number} input.gudangAsalId
 * @param {number} input.outletTujuanId
 * @param {number} [input.deviceId]
 * @param {Array<{itemId: number, qty: number}>} input.daftarItem
 * @returns {Promise<{ sesiId: number }>}
 */
async function buatSesiPengambilanCrew(input) {
  const { namaCrew, gudangAsalId, outletTujuanId, deviceId, crewId, crewSessionId, daftarItem, idempotencyKey } = input;

  // 1) Validasi field dasar — gagal cepat, gak perlu buka koneksi DB
  validasiFieldDasar({ namaCrew, daftarItem });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const idem = await beginIdempotent(client, {
      key: idempotencyKey,
      actorType: 'crew',
      actorId: crewId ?? `legacy:${namaCrew}`,
      endpoint: '/api/sesi-pengambilan-crew',
      body: { gudangAsalId, outletTujuanId, daftarItem },
    });
    if (idem.duplicate) {
      await client.query('ROLLBACK');
      return idem.response_body;
    }

    // 2) Validasi bisnis — pakai `client` yang sama biar dalam 1 transaksi
    await validasiOutletTujuan(client, { gudangAsalId, outletTujuanId });
    await validasiLaranganBahanAdonan(client, daftarItem);

    for (const { itemId, qty } of daftarItem) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`stok:${gudangAsalId}:${itemId}`]);
      const { rows: stokRows } = await client.query(
        'SELECT stok_saat_ini FROM v_stok_gudang_saat_ini WHERE gudang_id = $1 AND item_id = $2',
        [gudangAsalId, itemId],
      );
      if (Number(stokRows[0]?.stok_saat_ini ?? 0) < Number(qty)) {
        const err = new Error(`Stok tidak cukup untuk item id=${itemId}.`);
        err.status = 400;
        err.code = 'STOK_TIDAK_CUKUP';
        throw err;
      }
    }

    // 3) Insert sesi
    const sesiResult = await client.query(
      `INSERT INTO sesi_pengambilan_crew
         (nama_crew, gudang_asal_id, outlet_tujuan_id, device_id, crew_id, crew_session_id,
          sumber_transaksi, dibuat_oleh_role, versi_transaksi, status_verifikasi)
       VALUES ($1, $2, $3, $4, $5, $6, 'crew', 'crew', 1, 'unverified')
       RETURNING id`,
      [namaCrew.trim(), gudangAsalId, outletTujuanId, deviceId ?? null, crewId ?? null, crewSessionId ?? null]
    );
    const sesiId = sesiResult.rows[0].id;

    // 4) Insert semua baris item (trigger trg_pengambilan_item_ke_ledger
    //    otomatis nulis ke stok_ledger tiap baris ini di-insert)
    for (const { itemId, qty } of daftarItem) {
      await client.query(
        `INSERT INTO sesi_pengambilan_item (sesi_id, item_id, qty)
         VALUES ($1, $2, $3)`,
        [sesiId, itemId, qty]
      );
    }

    // 5) Catat aktivitas + notifikasi admin — dalam transaksi yang sama
    const { rows: outletRows } = await client.query(
      'SELECT nama FROM outlet WHERE id = $1', [outletTujuanId]
    );
    await onPengambilanDibuat(client, {
      sesiId,
      actorGudangId: gudangAsalId,
      actorNama: namaCrew.trim(),
      namaOutlet: outletRows[0]?.nama ?? 'outlet',
    });

    const response = { sesiId };
    await finishIdempotent(client, {
      key: idempotencyKey,
      actorType: 'crew',
      actorId: crewId ?? `legacy:${namaCrew}`,
      endpoint: '/api/sesi-pengambilan-crew',
      status: 201,
      body: response,
    });

    await client.query('COMMIT');
    return response;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err; // dilempar ke controller -> errorHandler
  } finally {
    client.release();
  }
}

module.exports = { buatSesiPengambilanCrew };

async function verifikasiPengambilan({ id, aksi, adminUserId, adminUserRole, alasan, buktiRef, idempotencyKey }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM sesi_pengambilan_crew WHERE id = $1 FOR UPDATE', [id]);
    const current = rows[0];
    if (!current) { const e = new Error('Pengambilan tidak ditemukan.'); e.status = 404; throw e; }
    if (!['approve', 'reject', 'revise'].includes(aksi)) { const e = new Error('Aksi verifikasi tidak valid.'); e.status = 400; throw e; }
    if (aksi === 'reject' && !alasan?.trim()) { const e = new Error('Alasan penolakan wajib diisi.'); e.status = 400; throw e; }
    const versi = Number(current.versi_transaksi || 1);
    const nextStatus = aksi === 'approve' ? 'approved' : aksi === 'reject' ? 'rejected' : 'revised';
    await client.query(
      `UPDATE sesi_pengambilan_crew
          SET status_verifikasi = $2, verifikasi_terakhir_at = now(),
              verifikasi_terakhir_oleh_user_id = $3, verifikasi_terakhir_oleh_role = $4,
              versi_transaksi = CASE WHEN $5 = 'revise' THEN versi_transaksi + 1 ELSE versi_transaksi END
        WHERE id = $1`,
      [id, nextStatus, adminUserId, adminUserRole, aksi],
    );
    await client.query(
      `INSERT INTO transaksi_verifikasi
       (transaksi_tipe, transaksi_id, versi_transaksi, aksi_verifikasi,
        dibuat_oleh_role, dibuat_oleh_crew_id, dibuat_oleh_user_id,
        diverifikasi_oleh_user_id, diverifikasi_oleh_role, waktu_verifikasi,
        alasan, bukti_nota_ref, nilai_sebelum, nilai_sesudah, idempotency_key)
       VALUES ('sesi_pengambilan_crew',$1,$2,$3,$4,$5,$6,$7,$8,now(),$9,$10,$11,$12,$13)`,
      [id, versi, aksi, current.dibuat_oleh_role || current.sumber_transaksi || 'crew', current.crew_id || null,
        current.dibuat_oleh_user_id || null, adminUserId, adminUserRole, alasan || null, buktiRef || null,
        current, { status_verifikasi: nextStatus }, idempotencyKey || null],
    );
    await client.query('COMMIT');
    return { id, aksi, versiTransaksi: versi };
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

module.exports = { buatSesiPengambilanCrew, verifikasiPengambilan };
