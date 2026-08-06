const { pool } = require('../db/pool');
const {
  validasiFieldDasar,
  validasiInputAdmin,
  validasiInputCrew,
  validasiSebelumVerifikasi,
} = require('../validators/barangMasukValidator');

/**
 * Barang Masuk diinput Admin (5.1) — langsung berstatus 'terverifikasi',
 * trigger DB trg_transaksi_masuk_ke_ledger otomatis nambah stok_ledger
 * begitu baris ini ke-insert.
 */
async function buatBarangMasukAdmin(input) {
  const { itemId, gudangId, jumlah, satuan, hargaBeli, sumber, fotoBuktiUrl, adminUserId, tanggal } = input;

  validasiFieldDasar({ itemId, jumlah, satuan, fotoBuktiUrl });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await validasiInputAdmin(client, { userId: adminUserId, gudangId });

    const { rows } = await client.query(
      `INSERT INTO transaksi_masuk
         (item_id, gudang_id, jumlah, satuan, harga_beli, sumber, foto_bukti_url,
          diinput_oleh_role, diinput_oleh_user_id,
          status_verifikasi, diverifikasi_oleh_user_id, tanggal_verifikasi, tanggal)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7,
          'admin', $8,
          'terverifikasi', $8, now(), COALESCE($9, CURRENT_DATE))
       RETURNING id`,
      [itemId, gudangId, jumlah, satuan, hargaBeli ?? null, sumber ?? null, fotoBuktiUrl, adminUserId, tanggal ?? null]
    );

    await client.query('COMMIT');
    return { id: rows[0].id, statusVerifikasi: 'terverifikasi' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Barang Masuk diinput Crew (5.1b) — status 'menunggu', BELUM masuk
 * stok_ledger (trigger cuma jalan kalau status_verifikasi='terverifikasi').
 */
async function buatBarangMasukCrew(input) {
  const { itemId, gudangId, jumlah, satuan, sumber, fotoBuktiUrl, deviceId, namaCrewInput, tanggal } = input;

  validasiFieldDasar({ itemId, jumlah, satuan, fotoBuktiUrl });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await validasiInputCrew(client, { deviceId, gudangId, namaCrewInput });

    const { rows } = await client.query(
      `INSERT INTO transaksi_masuk
         (item_id, gudang_id, jumlah, satuan, sumber, foto_bukti_url,
          diinput_oleh_role, diinput_oleh_device_id, nama_crew_input,
          status_verifikasi, tanggal)
       VALUES
         ($1, $2, $3, $4, $5, $6,
          'crew', $7, $8,
          'menunggu', COALESCE($9, CURRENT_DATE))
       RETURNING id`,
      [itemId, gudangId, jumlah, satuan, sumber ?? null, fotoBuktiUrl, deviceId, namaCrewInput.trim(), tanggal ?? null]
    );

    await client.query('COMMIT');
    return { id: rows[0].id, statusVerifikasi: 'menunggu' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verifikasi oleh Admin (5.1b): setujui / revisi / tolak.
 * - setujui: status -> 'terverifikasi', jumlah tetap, ledger otomatis nambah (trigger).
 * - revisi: admin ubah jumlah, status tetap jadi 'terverifikasi' (supaya ledger
 *   ke-trigger), tapi label_status="Direvisi Admin" dan catatan_verifikasi wajib
 *   diisi — jadi tetap keliatan di riwayat kalau ini bukan input asli crew.
 * - tolak: status -> 'ditolak', label_status="Ditolak Admin", TIDAK masuk ledger
 *   (trigger cuma jalan untuk status='terverifikasi').
 *
 * Row transaksi di-lock pakai `SELECT ... FOR UPDATE` di validator supaya dua
 * admin gak bisa verifikasi transaksi yang sama secara bersamaan (race condition).
 */
async function verifikasiBarangMasuk(input) {
  const { id, aksi, adminUserId, catatan, jumlahRevisi } = input;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await validasiSebelumVerifikasi(client, { id, aksi, adminUserId, catatan, jumlahRevisi });

    if (aksi === 'setujui') {
      await client.query(
        `UPDATE transaksi_masuk
         SET status_verifikasi = 'terverifikasi',
             diverifikasi_oleh_user_id = $2,
             tanggal_verifikasi = now(),
             catatan_verifikasi = $3
         WHERE id = $1`,
        [id, adminUserId, catatan ?? null]
      );
    } else if (aksi === 'revisi') {
      await client.query(
        `UPDATE transaksi_masuk
         SET jumlah = $2,
             status_verifikasi = 'terverifikasi',
             label_status = 'Direvisi Admin',
             diverifikasi_oleh_user_id = $3,
             tanggal_verifikasi = now(),
             catatan_verifikasi = $4
         WHERE id = $1`,
        [id, jumlahRevisi, adminUserId, catatan ?? null]
      );
    } else {
      // aksi === 'tolak'
      await client.query(
        `UPDATE transaksi_masuk
         SET status_verifikasi = 'ditolak',
             label_status = 'Ditolak Admin',
             diverifikasi_oleh_user_id = $2,
             tanggal_verifikasi = now(),
             catatan_verifikasi = $3
         WHERE id = $1`,
        [id, adminUserId, catatan]
      );
    }

    await client.query('COMMIT');
    return { id, aksi };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { buatBarangMasukAdmin, buatBarangMasukCrew, verifikasiBarangMasuk };
