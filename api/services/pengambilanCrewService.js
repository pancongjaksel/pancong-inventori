const { pool } = require('../db/pool');
const {
  validasiOutletTujuan,
  validasiLaranganBahanAdonan,
  validasiFieldDasar,
} = require('../validators/pengambilanCrewValidator');

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
  const { namaCrew, gudangAsalId, outletTujuanId, deviceId, daftarItem } = input;

  // 1) Validasi field dasar — gagal cepat, gak perlu buka koneksi DB
  validasiFieldDasar({ namaCrew, daftarItem });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2) Validasi bisnis — pakai `client` yang sama biar dalam 1 transaksi
    await validasiOutletTujuan(client, { gudangAsalId, outletTujuanId });
    await validasiLaranganBahanAdonan(client, daftarItem);

    // 3) Insert sesi
    const sesiResult = await client.query(
      `INSERT INTO sesi_pengambilan_crew (nama_crew, gudang_asal_id, outlet_tujuan_id, device_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [namaCrew.trim(), gudangAsalId, outletTujuanId, deviceId ?? null]
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

    await client.query('COMMIT');
    return { sesiId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err; // dilempar ke controller -> errorHandler
  } finally {
    client.release();
  }
}

module.exports = { buatSesiPengambilanCrew };
