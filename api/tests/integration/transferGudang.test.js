require('./helpers/setupEnv');
const { test, describe, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool, truncateSemua, seedDasar } = require('./helpers/fixtures');
const { kirimTransfer, terimaTransfer } = require('../../services/transferGudangService');
const { buatBarangMasukAdmin } = require('../../services/barangMasukService');

describe('transferGudangService', () => {
  let fx;

  beforeEach(async () => {
    await truncateSemua();
    fx = await seedDasar();
  });

  after(async () => {
    await pool.end();
  });

  test('DITOLAK kalau stok gudang asal gak cukup', async () => {
    // Stok UGM masih 0 (belum ada barang masuk), coba transfer 10 — harus ditolak
    await assert.rejects(
      () =>
        kirimTransfer({
          itemId: fx.itemBiasaId,
          gudangAsalId: fx.gudangUgmId,
          gudangTujuanId: fx.gudangGlagahsariId,
          jumlah: 10,
          fotoBuktiKirimUrl: 'https://contoh.com/bukti.jpg',
          dikirimOlehUserId: fx.adminId,
        }),
      (err) => {
        assert.equal(err.kode, 'STOK_TIDAK_CUKUP');
        return true;
      }
    );
  });

  test('kirim MENGURANGI stok gudang asal (via ledger transfer_keluar)', async () => {
    // Kasih stok UGM dulu 50 lewat barang masuk
    await buatBarangMasukAdmin({
      itemId: fx.itemBiasaId,
      gudangId: fx.gudangUgmId,
      jumlah: 50,
      satuan: 'Pack',
      fotoBuktiUrl: 'https://contoh.com/nota.jpg',
      adminUserId: fx.adminId,
    });

    await kirimTransfer({
      itemId: fx.itemBiasaId,
      gudangAsalId: fx.gudangUgmId,
      gudangTujuanId: fx.gudangGlagahsariId,
      jumlah: 20,
      fotoBuktiKirimUrl: 'https://contoh.com/bukti.jpg',
      dikirimOlehUserId: fx.adminId,
    });

    const { rows } = await pool.query(`SELECT stok_saat_ini FROM v_stok_gudang_saat_ini WHERE gudang_id = $1 AND item_id = $2`, [
      fx.gudangUgmId,
      fx.itemBiasaId,
    ]);
    assert.equal(Number(rows[0].stok_saat_ini), 30); // 50 - 20
  });

  test('gudang tujuan BELUM nambah sebelum "diterima" (masih "di jalan")', async () => {
    await buatBarangMasukAdmin({
      itemId: fx.itemBiasaId, gudangId: fx.gudangUgmId, jumlah: 50, satuan: 'Pack',
      fotoBuktiUrl: 'https://contoh.com/nota.jpg', adminUserId: fx.adminId,
    });
    await kirimTransfer({
      itemId: fx.itemBiasaId, gudangAsalId: fx.gudangUgmId, gudangTujuanId: fx.gudangGlagahsariId,
      jumlah: 20, fotoBuktiKirimUrl: 'https://contoh.com/bukti.jpg', dikirimOlehUserId: fx.adminId,
    });

    const { rows } = await pool.query(`SELECT stok_saat_ini FROM v_stok_gudang_saat_ini WHERE gudang_id = $1 AND item_id = $2`, [
      fx.gudangGlagahsariId,
      fx.itemBiasaId,
    ]);
    assert.equal(Number(rows[0].stok_saat_ini), 0, 'gudang tujuan masih 0 sebelum dikonfirmasi diterima');
  });

  test('setelah "diterima", stok gudang tujuan BERTAMBAH', async () => {
    await buatBarangMasukAdmin({
      itemId: fx.itemBiasaId, gudangId: fx.gudangUgmId, jumlah: 50, satuan: 'Pack',
      fotoBuktiUrl: 'https://contoh.com/nota.jpg', adminUserId: fx.adminId,
    });
    const transfer = await kirimTransfer({
      itemId: fx.itemBiasaId, gudangAsalId: fx.gudangUgmId, gudangTujuanId: fx.gudangGlagahsariId,
      jumlah: 20, fotoBuktiKirimUrl: 'https://contoh.com/bukti.jpg', dikirimOlehUserId: fx.adminId,
    });

    // Pakai ownerId buat terima — owner otomatis punya akses semua gudang,
    // beda dari fx.adminId yang cuma punya akses ke Gudang UGM.
    await terimaTransfer({ id: transfer.id, diterimaOlehUserId: fx.ownerId, fotoBuktiTerimaUrl: 'https://contoh.com/terima.jpg' });

    const { rows } = await pool.query(`SELECT stok_saat_ini FROM v_stok_gudang_saat_ini WHERE gudang_id = $1 AND item_id = $2`, [
      fx.gudangGlagahsariId,
      fx.itemBiasaId,
    ]);
    assert.equal(Number(rows[0].stok_saat_ini), 20);
  });

  test('DITOLAK kalau transfer yang sama diterima dua kali', async () => {
    await buatBarangMasukAdmin({
      itemId: fx.itemBiasaId, gudangId: fx.gudangUgmId, jumlah: 50, satuan: 'Pack',
      fotoBuktiUrl: 'https://contoh.com/nota.jpg', adminUserId: fx.adminId,
    });
    const transfer = await kirimTransfer({
      itemId: fx.itemBiasaId, gudangAsalId: fx.gudangUgmId, gudangTujuanId: fx.gudangGlagahsariId,
      jumlah: 20, fotoBuktiKirimUrl: 'https://contoh.com/bukti.jpg', dikirimOlehUserId: fx.adminId,
    });

    await terimaTransfer({ id: transfer.id, diterimaOlehUserId: fx.ownerId, fotoBuktiTerimaUrl: 'https://contoh.com/terima.jpg' });

    await assert.rejects(
      () => terimaTransfer({ id: transfer.id, diterimaOlehUserId: fx.ownerId, fotoBuktiTerimaUrl: 'https://contoh.com/terima-lagi.jpg' }),
      (err) => {
        assert.equal(err.kode, 'TRANSFER_SUDAH_DITERIMA');
        return true;
      }
    );
  });

  test('DITOLAK kalau gudang asal dan tujuan sama', async () => {
    await assert.rejects(
      () =>
        kirimTransfer({
          itemId: fx.itemBiasaId,
          gudangAsalId: fx.gudangUgmId,
          gudangTujuanId: fx.gudangUgmId,
          jumlah: 5,
          fotoBuktiKirimUrl: 'https://contoh.com/bukti.jpg',
          dikirimOlehUserId: fx.adminId,
        }),
      (err) => {
        assert.equal(err.kode, 'GUDANG_SAMA');
        return true;
      }
    );
  });
});
