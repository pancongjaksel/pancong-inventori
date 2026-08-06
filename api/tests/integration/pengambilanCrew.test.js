require('./helpers/setupEnv');
const { test, describe, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool, truncateSemua, seedDasar } = require('./helpers/fixtures');
const { buatSesiPengambilanCrew } = require('../../services/pengambilanCrewService');

describe('pengambilanCrewService.buatSesiPengambilanCrew', () => {
  let fx;

  beforeEach(async () => {
    await truncateSemua();
    fx = await seedDasar();
  });

  after(async () => {
    await pool.end();
  });

  test('DITOLAK kalau outlet tujuan bukan yang dilayani gudang device (outlet-gudang mismatch)', async () => {
    // Device di Gudang UGM, tapi kirim ke Outlet UMY (dilayani Glagahsari) — harus ditolak
    await assert.rejects(
      () =>
        buatSesiPengambilanCrew({
          namaCrew: 'Budi',
          gudangAsalId: fx.gudangUgmId,
          outletTujuanId: fx.outletUmyId, // salah, ini punya Glagahsari
          deviceId: fx.deviceId,
          daftarItem: [{ itemId: fx.itemBiasaId, qty: 5 }],
        }),
      (err) => {
        assert.equal(err.kode, 'OUTLET_TIDAK_SESUAI_GUDANG');
        return true;
      }
    );
  });

  test('DITOLAK kalau ada item Bahan Adonan selain BA-008', async () => {
    await assert.rejects(
      () =>
        buatSesiPengambilanCrew({
          namaCrew: 'Budi',
          gudangAsalId: fx.gudangUgmId,
          outletTujuanId: fx.outletUgmId,
          deviceId: fx.deviceId,
          daftarItem: [{ itemId: fx.itemBahanAdonanDilarangId, qty: 1 }],
        }),
      (err) => {
        assert.equal(err.kode, 'ITEM_BAHAN_ADONAN_DILARANG');
        return true;
      }
    );
  });

  test('LOLOS kalau item-nya BA-008 (satu-satunya Bahan Adonan yang dikecualikan)', async () => {
    const hasil = await buatSesiPengambilanCrew({
      namaCrew: 'Budi',
      gudangAsalId: fx.gudangUgmId,
      outletTujuanId: fx.outletUgmId,
      deviceId: fx.deviceId,
      daftarItem: [{ itemId: fx.itemBA008Id, qty: 2 }],
    });
    assert.ok(hasil.sesiId);
  });

  test('sesi sukses bikin baris stok_ledger keluar_ke_crew dengan qty_delta NEGATIF', async () => {
    await buatSesiPengambilanCrew({
      namaCrew: 'Budi',
      gudangAsalId: fx.gudangUgmId,
      outletTujuanId: fx.outletUgmId,
      deviceId: fx.deviceId,
      daftarItem: [{ itemId: fx.itemBiasaId, qty: 7 }],
    });

    const { rows } = await pool.query(
      `SELECT tipe_pergerakan, qty_delta FROM stok_ledger WHERE item_id = $1 AND gudang_id = $2`,
      [fx.itemBiasaId, fx.gudangUgmId]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].tipe_pergerakan, 'keluar_ke_crew');
    assert.equal(Number(rows[0].qty_delta), -7);
  });

  test('sesi dengan banyak item tersimpan sebagai satu sesi_id yang sama (bukan transaksi terpisah)', async () => {
    const hasil = await buatSesiPengambilanCrew({
      namaCrew: 'Budi',
      gudangAsalId: fx.gudangUgmId,
      outletTujuanId: fx.outletUgmId,
      deviceId: fx.deviceId,
      daftarItem: [
        { itemId: fx.itemBiasaId, qty: 3 },
        { itemId: fx.itemBA008Id, qty: 1 },
      ],
    });

    const { rows } = await pool.query(`SELECT COUNT(*) FROM sesi_pengambilan_item WHERE sesi_id = $1`, [hasil.sesiId]);
    assert.equal(Number(rows[0].count), 2);
  });
});
