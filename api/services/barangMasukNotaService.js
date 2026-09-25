const { pool } = require('../db/pool');
const {
  validasiFieldNota,
  validasiUpdateHargaNota,
  validasiInputAdminNota,
  validasiInputCrewNota,
  validasiInputAdminGudangNota,
  validasiSebelumVerifikasiNota,
} = require('../validators/barangMasukNotaValidator');
const { beginIdempotent, finishIdempotent } = require('./idempotencyService');
const { AppError } = require('../errors/AppError');

async function buatNotaAdmin(input) {
  const { gudangId, items, sumber, fotoBuktiUrl, adminUserId, tanggal } = input;
  const idempotencyKey = input.idempotencyKey;

  validasiFieldNota({ items, fotoBuktiUrl });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const idem = await beginIdempotent(client, { key: idempotencyKey, actorType: 'user', actorId: adminUserId, endpoint: '/api/barang-masuk-nota/admin', body: input });
    if (idem.duplicate) { await client.query('ROLLBACK'); return idem.response_body; }
    await validasiInputAdminNota(client, { userId: adminUserId, gudangId });

    // Nota diinsert dulu sebagai 'menunggu' (BUKAN langsung 'terverifikasi') karena
    // trigger fn_transaksi_masuk_nota_ke_ledger jalan AFTER INSERT dan butuh baris
    // transaksi_masuk_item sudah ada buat di-fan-out ke stok_ledger. Kalau nota
    // langsung diinsert 'terverifikasi', trigger nembak duluan sebelum item-nya ada
    // -> 0 baris ledger, stok gak nambah sama sekali (silent, gak ada error).
    // Makanya di-UPDATE ke 'terverifikasi' belakangan, setelah semua item masuk —
    // sama persis pola yang dipakai verifikasiNota() buat aksi 'setujui'.
    const { rows } = await client.query(
      `INSERT INTO transaksi_masuk_nota
         (gudang_id, sumber, foto_bukti_url, diinput_oleh_role, diinput_oleh_user_id,
         status_verifikasi, tanggal, sumber_transaksi, dibuat_oleh_user_id, versi_transaksi)
       VALUES ($1, $2, $3, 'admin', $4, 'menunggu', COALESCE($5, CURRENT_DATE), 'admin', $4, 1)
       RETURNING id`,
      [gudangId, sumber ?? null, fotoBuktiUrl, adminUserId, tanggal ?? null]
    );
    const notaId = rows[0].id;

    for (const it of items) {
      await client.query(
        `INSERT INTO transaksi_masuk_item (nota_id, item_id, jumlah, satuan, harga_beli)
         VALUES ($1, $2, $3, $4, $5)`,
        [notaId, it.itemId, it.jumlah, it.satuan, it.hargaBeli ?? null]
      );
    }

    await client.query(
      `UPDATE transaksi_masuk_nota
       SET status_verifikasi = 'terverifikasi', diverifikasi_oleh_user_id = $2, tanggal_verifikasi = now()
       WHERE id = $1`,
      [notaId, adminUserId]
    );
    await finishIdempotent(client, { key: idempotencyKey, actorType: 'user', actorId: adminUserId, endpoint: '/api/barang-masuk-nota/admin', status: 201, body: { notaId, statusVerifikasi: 'terverifikasi', jumlahItem: items.length } });

    await client.query('COMMIT');
    return { notaId, statusVerifikasi: 'terverifikasi', jumlahItem: items.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Device Admin Gudang — beda dari buatNotaAdmin: TETAP masuk 'menunggu',
 * BUKAN langsung 'terverifikasi'. Siapa yang input nota gak boleh sekaligus
 * jadi yang approve — meski attribusinya sama-sama diinput_oleh_role='admin'
 * (gudangId dipilih dari form, bukan dari device token — admin_gudang gak
 * gudang-scoped), tetap butuh verifikasi admin/owner lewat verifikasiNota()
 * kayak nota dari crew.
 */
async function buatNotaAdminGudang(input) {
  const { gudangId, items, sumber, fotoBuktiUrl, adminGudangUserId, tanggal } = input;
  const idempotencyKey = input.idempotencyKey;

  validasiFieldNota({ items, fotoBuktiUrl });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const idem = await beginIdempotent(client, { key: idempotencyKey, actorType: 'user', actorId: adminGudangUserId, endpoint: '/api/barang-masuk-nota/admin-gudang', body: input });
    if (idem.duplicate) { await client.query('ROLLBACK'); return idem.response_body; }
    await validasiInputAdminGudangNota(client, { userId: adminGudangUserId, gudangId });

    const { rows } = await client.query(
      `INSERT INTO transaksi_masuk_nota
         (gudang_id, sumber, foto_bukti_url, diinput_oleh_role, diinput_oleh_user_id, status_verifikasi, tanggal, sumber_transaksi, dibuat_oleh_user_id, versi_transaksi)
       VALUES ($1, $2, $3, 'admin', $4, 'menunggu', COALESCE($5, CURRENT_DATE), 'admin_gudang', $4, 1)
       RETURNING id`,
      [gudangId, sumber ?? null, fotoBuktiUrl, adminGudangUserId, tanggal ?? null]
    );
    const notaId = rows[0].id;

    for (const it of items) {
      await client.query(
        `INSERT INTO transaksi_masuk_item (nota_id, item_id, jumlah, satuan, harga_beli)
         VALUES ($1, $2, $3, $4, $5)`,
        [notaId, it.itemId, it.jumlah, it.satuan, it.hargaBeli ?? null]
      );
    }

    await finishIdempotent(client, { key: idempotencyKey, actorType: 'user', actorId: adminGudangUserId, endpoint: '/api/barang-masuk-nota/admin-gudang', status: 201, body: { notaId, statusVerifikasi: 'menunggu', jumlahItem: items.length } });
    await client.query('COMMIT');
    const response = { notaId, statusVerifikasi: 'menunggu', jumlahItem: items.length };
    return response;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function buatNotaCrew(input) {
  const { gudangId, items, sumber, fotoBuktiUrl, namaCrewInput, tanggal } = input;
  const idempotencyKey = input.idempotencyKey;

  validasiFieldNota({ items, fotoBuktiUrl });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const idem = await beginIdempotent(client, { key: idempotencyKey, actorType: 'crew', actorId: input.crewId ?? `legacy:${namaCrewInput}`, endpoint: '/api/barang-masuk-nota/crew', body: input });
    if (idem.duplicate) { await client.query('ROLLBACK'); return idem.response_body; }
    await validasiInputCrewNota(client, { gudangId, namaCrewInput });

    const { rows } = await client.query(
      `INSERT INTO transaksi_masuk_nota
         (gudang_id, sumber, foto_bukti_url, diinput_oleh_role, nama_crew_input, status_verifikasi, tanggal, dibuat_oleh_crew_id, crew_session_id, sumber_transaksi, versi_transaksi)
       VALUES ($1, $2, $3, 'crew', $4, 'menunggu', COALESCE($5, CURRENT_DATE), $6, $7, 'crew', 1)
       RETURNING id`,
      [gudangId, sumber ?? null, fotoBuktiUrl, namaCrewInput.trim(), tanggal ?? null, input.crewId ?? null, input.crewSessionId ?? null]
    );
    const notaId = rows[0].id;

    for (const it of items) {
      await client.query(
        `INSERT INTO transaksi_masuk_item (nota_id, item_id, jumlah, satuan)
         VALUES ($1, $2, $3, $4)`,
        [notaId, it.itemId, it.jumlah, it.satuan]
      );
    }

    const response = { notaId, statusVerifikasi: 'menunggu', jumlahItem: items.length };
    await finishIdempotent(client, { key: idempotencyKey, actorType: 'crew', actorId: input.crewId ?? `legacy:${namaCrewInput}`, endpoint: '/api/barang-masuk-nota/crew', status: 201, body: response });
    await client.query('COMMIT');
    return response;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function verifikasiNota(input) {
  const { id, aksi, adminUserId, adminUserRole = 'admin_gudang', catatan, revisiItems } = input;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await validasiSebelumVerifikasiNota(client, { id, aksi, adminUserId, catatan, revisiItems });

    const { rows: currentRows } = await client.query('SELECT * FROM transaksi_masuk_nota WHERE id = $1 FOR UPDATE', [id]);
    const current = currentRows[0];
    const nextVersion = Number(current.versi_transaksi || 1) + (aksi === 'revisi' ? 1 : 0);
    const aksiAudit = { setujui: 'approve', revisi: 'revise', tolak: 'reject' }[aksi];
    if (aksi === 'setujui') {
      await client.query(
        `UPDATE transaksi_masuk_nota
         SET status_verifikasi = 'terverifikasi', diverifikasi_oleh_user_id = $2,
             tanggal_verifikasi = now(), catatan_verifikasi = $3,
             verifikasi_terakhir_at = now(), verifikasi_terakhir_oleh_user_id = $2,
             verifikasi_terakhir_oleh_role = $4
         WHERE id = $1`,
        [id, adminUserId, catatan ?? null, adminUserRole]
      );
    } else if (aksi === 'revisi') {
      for (const ri of revisiItems) {
        await client.query(
          `UPDATE transaksi_masuk_item SET jumlah = $2 WHERE id = $1 AND nota_id = $3`,
          [ri.itemRowId, ri.jumlahBaru, id]
        );
      }
      await client.query(
        `UPDATE transaksi_masuk_nota
         SET status_verifikasi = 'terverifikasi', label_status = 'Direvisi Admin',
             diverifikasi_oleh_user_id = $2, tanggal_verifikasi = now(), catatan_verifikasi = $3,
             verifikasi_terakhir_at = now(), verifikasi_terakhir_oleh_user_id = $2,
             verifikasi_terakhir_oleh_role = $4
         WHERE id = $1`,
        [id, adminUserId, catatan ?? null, adminUserRole]
      );
    } else {
      await client.query(
        `UPDATE transaksi_masuk_nota
         SET status_verifikasi = 'ditolak', label_status = 'Ditolak Admin',
             diverifikasi_oleh_user_id = $2, tanggal_verifikasi = now(), catatan_verifikasi = $3,
             verifikasi_terakhir_at = now(), verifikasi_terakhir_oleh_user_id = $2,
             verifikasi_terakhir_oleh_role = $4
         WHERE id = $1`,
        [id, adminUserId, catatan, adminUserRole]
      );
    }

    await client.query(
      `INSERT INTO transaksi_verifikasi
       (transaksi_tipe, transaksi_id, versi_transaksi, aksi_verifikasi,
        dibuat_oleh_role, dibuat_oleh_crew_id, dibuat_oleh_user_id,
        diverifikasi_oleh_user_id, diverifikasi_oleh_role, alasan,
        bukti_nota_ref, nilai_sebelum, nilai_sesudah, idempotency_key)
       VALUES ('transaksi_masuk_nota',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, Number(current.versi_transaksi || 1), aksiAudit, current.sumber_transaksi || current.diinput_oleh_role,
        current.dibuat_oleh_crew_id || null, current.diinput_oleh_user_id || null, adminUserId,
        adminUserRole, catatan || null, current.foto_bukti_url || null,
        current, { aksi, revisiItems: revisiItems || null }, input.idempotencyKey || null],
    );
    if (aksi === 'revisi') await client.query('UPDATE transaksi_masuk_nota SET versi_transaksi = $2 WHERE id = $1', [id, nextVersion]);

    await client.query('COMMIT');
    return { id, aksi };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listNota(status, filters = {}) {
  const filterSemua = status === 'semua';
  const batas = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  const mulai = Math.max(Number(filters.offset) || 0, 0);
  const kondisi = [];
  const params = [];

  if (!filterSemua) {
    params.push(status);
    kondisi.push(`tmn.status_verifikasi = $${params.length}`);
  }
  if (filters.dari) {
    params.push(filters.dari);
    kondisi.push(`tmn.created_at >= $${params.length}::date`);
  }
  if (filters.sampai) {
    params.push(filters.sampai);
    kondisi.push(`tmn.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    kondisi.push(`(g.nama ILIKE $${params.length} OR COALESCE(tmn.sumber, '') ILIKE $${params.length} OR COALESCE(u.nama, tmn.nama_crew_input, '') ILIKE $${params.length})`);
  }
  params.push(batas, mulai);
  const { rows: notaRows } = await pool.query(
    `SELECT tmn.id, tmn.sumber, tmn.foto_bukti_url, tmn.diinput_oleh_role, tmn.nama_crew_input,
            tmn.status_verifikasi, tmn.label_status, tmn.catatan_verifikasi, tmn.tanggal, tmn.created_at, tmn.tanggal_verifikasi,
            g.nama AS nama_gudang, u.nama AS diinput_oleh_admin_nama
     FROM transaksi_masuk_nota tmn
     JOIN gudang g ON g.id = tmn.gudang_id
     LEFT JOIN users u ON u.id = tmn.diinput_oleh_user_id
     WHERE ${kondisi.length ? kondisi.join(' AND ') : 'TRUE'}
     ORDER BY tmn.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  if (notaRows.length === 0) return [];

  const notaIds = notaRows.map((n) => n.id);
  const { rows: itemRows } = await pool.query(
    `SELECT tmi.id AS item_row_id, tmi.nota_id, tmi.jumlah, tmi.satuan, tmi.harga_beli,
            i.kode_barang, i.nama AS nama_item
     FROM transaksi_masuk_item tmi
     JOIN item i ON i.id = tmi.item_id
     WHERE tmi.nota_id = ANY($1)
     ORDER BY tmi.id`,
    [notaIds]
  );

  return notaRows.map((n) => ({
    ...n,
    items: itemRows.filter((it) => it.nota_id === n.id),
  }));
}

async function getNota(id) {
  const { rows } = await pool.query(
    `SELECT tmn.id, tmn.sumber, tmn.foto_bukti_url, tmn.diinput_oleh_role, tmn.nama_crew_input,
            tmn.status_verifikasi, tmn.label_status, tmn.catatan_verifikasi, tmn.tanggal, tmn.created_at, tmn.tanggal_verifikasi,
            g.nama AS nama_gudang, u.nama AS diinput_oleh_admin_nama,
            v.nama AS diverifikasi_oleh_nama
     FROM transaksi_masuk_nota tmn
     JOIN gudang g ON g.id = tmn.gudang_id
     LEFT JOIN users u ON u.id = tmn.diinput_oleh_user_id
     LEFT JOIN users v ON v.id = tmn.diverifikasi_oleh_user_id
     WHERE tmn.id = $1`,
    [id]
  );
  if (rows.length === 0) return null;
  const nota = rows[0];
  const { rows: itemRows } = await pool.query(
    `SELECT tmi.id AS item_row_id, tmi.nota_id, tmi.jumlah, tmi.satuan, tmi.harga_beli,
            i.kode_barang, i.nama AS nama_item
     FROM transaksi_masuk_item tmi
     JOIN item i ON i.id = tmi.item_id
     WHERE tmi.nota_id = $1
     ORDER BY tmi.id`,
    [id]
  );
  const { rows: riwayatHarga } = await pool.query(
    `SELECT audit.transaksi_masuk_item_id AS item_row_id, audit.harga_sebelum,
            audit.harga_sesudah, audit.created_at, u.nama AS diubah_oleh_nama
     FROM transaksi_masuk_harga_audit audit
     JOIN users u ON u.id = audit.diubah_oleh_user_id
     WHERE audit.nota_id = $1
     ORDER BY audit.created_at DESC, audit.id DESC`,
    [id]
  );
  return { ...nota, items: itemRows, riwayatHarga };
}

/**
 * Harga boleh dilengkapi atau dikoreksi setelah nota diterima. Stok tidak
 * berubah: ini murni metadata nilai pembelian yang dipakai laporan keuangan.
 */
async function updateHargaNota({ id, items, adminUserId }) {
  validasiUpdateHargaNota({ items });
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
    throw new AppError('Nota barang masuk tidak valid.', 400, 'NOTA_TIDAK_VALID');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: notaRows } = await client.query(
      'SELECT id, status_verifikasi FROM transaksi_masuk_nota WHERE id = $1 FOR UPDATE',
      [id]
    );
    const nota = notaRows[0];
    if (!nota) throw new AppError('Nota barang masuk tidak ditemukan.', 404, 'NOTA_TIDAK_DITEMUKAN');
    if (nota.status_verifikasi !== 'terverifikasi') {
      throw new AppError('Harga hanya bisa diisi untuk nota yang sudah terverifikasi.', 409, 'NOTA_BELUM_TERVERIFIKASI');
    }

    const itemRowIds = items.map((item) => Number(item.itemRowId));
    const { rows: barisNota } = await client.query(
      `SELECT id, harga_beli
       FROM transaksi_masuk_item
       WHERE nota_id = $1 AND id = ANY($2::int[])
       FOR UPDATE`,
      [id, itemRowIds]
    );
    if (barisNota.length !== items.length) {
      throw new AppError('Salah satu barang bukan bagian dari nota ini.', 400, 'ITEM_BEDA_NOTA');
    }

    const hargaLama = new Map(barisNota.map((baris) => [baris.id, baris.harga_beli]));
    let jumlahDiubah = 0;
    for (const item of items) {
      const itemRowId = Number(item.itemRowId);
      const hargaBeli = Number(item.hargaBeli);
      const sebelum = hargaLama.get(itemRowId);
      if (sebelum !== null && Number(sebelum) === hargaBeli) continue;

      await client.query(
        'UPDATE transaksi_masuk_item SET harga_beli = $1 WHERE id = $2 AND nota_id = $3',
        [hargaBeli, itemRowId, id]
      );
      await client.query(
        `INSERT INTO transaksi_masuk_harga_audit
         (nota_id, transaksi_masuk_item_id, harga_sebelum, harga_sesudah, diubah_oleh_user_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, itemRowId, sebelum, hargaBeli, adminUserId]
      );
      jumlahDiubah += 1;
    }

    await client.query('COMMIT');
    return { notaId: Number(id), jumlahDiubah };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Badge count nav "Verifikasi" — query ringan, gak perlu batch item kayak listNota. */
async function jumlahNotaMenunggu() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS jumlah FROM transaksi_masuk_nota WHERE status_verifikasi = 'menunggu'`
  );
  return rows[0].jumlah;
}

module.exports = {
  buatNotaAdmin,
  buatNotaAdminGudang,
  buatNotaCrew,
  verifikasiNota,
  listNota,
  getNota,
  updateHargaNota,
  jumlahNotaMenunggu,
};
