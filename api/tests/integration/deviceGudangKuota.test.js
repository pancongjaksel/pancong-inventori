require('./helpers/setupEnv');
const { test, describe, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool, truncateSemua, seedDasar } = require('./helpers/fixtures');
const { setupDeviceDariQr, getKuotaSemuaGudang, updateKuotaGudang } = require('../../services/deviceGudangService');
const { buatTokenQrGudang } = require('../../utils/deviceQrToken');

describe('deviceGudangService — kuota device per gudang', () => {
  let fx;

  beforeEach(async () => {
    await truncateSemua();
    fx = await seedDasar(); // udah ada 1 device aktif di Gudang UGM (Device Test UGM)
  });

  after(async () => {
    await pool.end();
  });

  test('setup device baru lolos kalau kuota masih ada', async () => {
    const token = buatTokenQrGudang(fx.gudangUgmId);
    const hasil = await setupDeviceDariQr({ token, namaDevice: 'HP Kasir UGM 2', adminUserId: fx.adminId });
    assert.equal(hasil.gudangId, fx.gudangUgmId);
    assert.ok(hasil.deviceToken);
  });

  test('DITOLAK 409 kalau kuota gudang udah penuh', async () => {
    // Set kuota UGM jadi 1 — fixture udah punya 1 device aktif di UGM, jadi udah penuh
    await updateKuotaGudang(fx.gudangUgmId, 1);

    const token = buatTokenQrGudang(fx.gudangUgmId);
    await assert.rejects(
      () => setupDeviceDariQr({ token, namaDevice: 'HP Kasir UGM Kelebihan', adminUserId: fx.adminId }),
      (err) => {
        assert.equal(err.kode, 'KUOTA_DEVICE_PENUH');
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  test('DITOLAK kalau nama device kosong', async () => {
    const token = buatTokenQrGudang(fx.gudangUgmId);
    await assert.rejects(
      () => setupDeviceDariQr({ token, namaDevice: '  ', adminUserId: fx.adminId }),
      (err) => {
        assert.equal(err.kode, 'NAMA_DEVICE_KOSONG');
        return true;
      }
    );
  });

  test('DITOLAK kalau token QR rusak/gudang gak valid', async () => {
    await assert.rejects(
      () => setupDeviceDariQr({ token: 'token-ngaco-bukan-hasil-scan', namaDevice: 'HP Test', adminUserId: fx.adminId }),
      (err) => {
        assert.equal(err.kode, 'QR_TIDAK_VALID');
        return true;
      }
    );
  });

  test('getKuotaSemuaGudang balikin status kuota & daftar device per gudang', async () => {
    const hasil = await getKuotaSemuaGudang();
    const ugm = hasil.find((g) => g.gudangId === fx.gudangUgmId);
    assert.equal(ugm.maxQuota, 5);
    assert.equal(ugm.currentCount, 1); // dari seed
    assert.equal(ugm.availableSlots, 4);
    assert.equal(ugm.devices.length, 1);
  });

  test('updateKuotaGudang ubah nilai kuota gudang', async () => {
    const hasil = await updateKuotaGudang(fx.gudangUgmId, 8);
    assert.equal(hasil.max_device_quota, 8);
  });

  test('updateKuotaGudang DITOLAK kalau kuota negatif', async () => {
    await assert.rejects(
      () => updateKuotaGudang(fx.gudangUgmId, -1),
      (err) => {
        assert.equal(err.kode, 'KUOTA_TIDAK_VALID');
        return true;
      }
    );
  });
});
