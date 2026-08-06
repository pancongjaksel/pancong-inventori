require('./setupEnv');
const { pool } = require('../../../db/pool');
const { hashPassword } = require('../../../utils/passwordHash');

/** Kosongin SEMUA tabel bisnis (bukan cuma data transaksi, master data juga)
 * — tiap test file seed ulang fixture-nya sendiri lewat seedDasar(), biar
 * test gak saling ketuker data antar file. */
async function truncateSemua() {
  await pool.query(`
    TRUNCATE TABLE
      stok_ledger, koreksi_transaksi, stok_opname,
      transaksi_produksi_bahan, transaksi_produksi,
      transfer_gudang, sesi_pengambilan_item, sesi_pengambilan_crew,
      transaksi_masuk, device_gudang, user_akses_gudang,
      resep_bahan, resep_bom,
      item, outlet, gudang, users
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Seed fixture dasar yang dipakai berulang di banyak test: 3 gudang (sesuai
 * struktur asli PRD), 2 outlet, 3 item (1 biasa, 1 Bahan Adonan yang
 * dilarang, 1 BA-008 yang dikecualikan), 1 owner + 1 admin (dengan akses
 * cuma ke Gudang UGM, buat nes akses-gudang), dan 1 device aktif di Gudang UGM.
 *
 * @returns {Promise<object>} id semua fixture, siap dipakai test
 */
async function seedDasar() {
  const gudangProduksi = await pool.query(
    `INSERT INTO gudang (nama, tipe) VALUES ('Produksi', 'hub_admin_only') RETURNING id`
  );
  const gudangUgm = await pool.query(
    `INSERT INTO gudang (nama, tipe) VALUES ('UGM', 'serving') RETURNING id`
  );
  const gudangGlagahsari = await pool.query(
    `INSERT INTO gudang (nama, tipe) VALUES ('Glagahsari', 'serving') RETURNING id`
  );

  const outletUgm = await pool.query(
    `INSERT INTO outlet (nama, gudang_asal_id) VALUES ('UGM', $1) RETURNING id`,
    [gudangUgm.rows[0].id]
  );
  const outletUmy = await pool.query(
    `INSERT INTO outlet (nama, gudang_asal_id) VALUES ('UMY', $1) RETURNING id`,
    [gudangGlagahsari.rows[0].id]
  );

  const itemBiasa = await pool.query(
    `INSERT INTO item (kode_barang, nama, kategori, satuan) VALUES ('TEST-001', 'Tissue Test', 'Kebersihan', 'Pack') RETURNING id`
  );
  const itemBahanAdonanDilarang = await pool.query(
    `INSERT INTO item (kode_barang, nama, kategori, satuan) VALUES ('BA-TEST', 'Tepung Test', 'Bahan Adonan', 'Kg') RETURNING id`
  );
  const itemBA008 = await pool.query(
    `INSERT INTO item (kode_barang, nama, kategori, satuan) VALUES ('BA-008', 'Pandan Pasta Test', 'Bahan Adonan', 'Pack') RETURNING id`
  );

  const passwordHash = await hashPassword('password-test-123');
  const owner = await pool.query(
    `INSERT INTO users (nama, email, password_hash, role) VALUES ('Owner Test', 'owner-test@example.com', $1, 'owner') RETURNING id`,
    [passwordHash]
  );
  const admin = await pool.query(
    `INSERT INTO users (nama, email, password_hash, role) VALUES ('Admin Test', 'admin-test@example.com', $1, 'admin') RETURNING id`,
    [passwordHash]
  );
  await pool.query(`INSERT INTO user_akses_gudang (user_id, gudang_id) VALUES ($1, $2)`, [
    admin.rows[0].id,
    gudangUgm.rows[0].id,
  ]);

  const device = await pool.query(
    `INSERT INTO device_gudang (nama_device, gudang_id) VALUES ('Device Test UGM', $1) RETURNING id`,
    [gudangUgm.rows[0].id]
  );

  return {
    gudangProduksiId: gudangProduksi.rows[0].id,
    gudangUgmId: gudangUgm.rows[0].id,
    gudangGlagahsariId: gudangGlagahsari.rows[0].id,
    outletUgmId: outletUgm.rows[0].id,
    outletUmyId: outletUmy.rows[0].id,
    itemBiasaId: itemBiasa.rows[0].id,
    itemBahanAdonanDilarangId: itemBahanAdonanDilarang.rows[0].id,
    itemBA008Id: itemBA008.rows[0].id,
    ownerId: owner.rows[0].id,
    adminId: admin.rows[0].id,
    deviceId: device.rows[0].id,
  };
}

module.exports = { pool, truncateSemua, seedDasar };
