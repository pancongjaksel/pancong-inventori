require('./helpers/setupEnv');
const { test, describe, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool, truncateSemua, seedDasar } = require('./helpers/fixtures');
const { buatBarangMasukAdmin, buatBarangMasukCrew, verifikasiBarangMasuk } = require('../../services/barangMasukService');

describe('barangMasukService', () => {
  let fx;

  beforeEach(async () => {
    await truncateSemua();
    fx = await seedDasar();
  });

  after(async () => {
    await pool.end();
  });

  test('input Admin langsung status terverifikasi DAN langsung masuk stok_ledger', async () => {
    const hasil = await buatBarangMasukAdmin({
      itemId: fx.itemBiasaId,
      gudangId: fx.gudangUgmId,
      jumlah: 20,
      satuan: 'Pack',
      fotoBuktiUrl: 'https://contoh.com/nota.jpg',
      adminUserId: fx.adminId,
    });
    assert.equal(hasil.statusVerifikasi, 'terverifikasi');

    const { rows } = await pool.query(`SELECT qty_delta FROM stok_ledger WHERE item_id = $1`, [fx.itemBiasaId]);
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].qty_delta), 20);
  });

  test('input Crew status menunggu DAN BELUM masuk stok_ledger sama sekali', async () => {
    const hasil = await buatBarangMasukCrew({
      itemId: fx.itemBiasaId,
      gudangId: fx.gudangUgmId,
      jumlah: 15,
      satuan: 'Pack',
      fotoBuktiUrl: 'https://contoh.com/nota.jpg',
      deviceId: fx.deviceId,
      namaCrewInput: 'Budi',
    });
    assert.equal(hasil.statusVerifikasi, 'menunggu');

    const { rows } = await pool.query(`SELECT * FROM stok_ledger WHERE item_id = $1`, [fx.itemBiasaId]);
    assert.equal(rows.length, 0, 'belum boleh ada baris ledger sebelum diverifikasi Admin');
  });

  test('setelah Admin SETUJUI input Crew, baru masuk stok_ledger', async () => {
    const inputCrew = await buatBarangMasukCrew({
      itemId: fx.itemBiasaId,
      gudangId: fx.gudangUgmId,
      jumlah: 15,
      satuan: 'Pack',
      fotoBuktiUrl: 'https://contoh.com/nota.jpg',
      deviceId: fx.deviceId,
      namaCrewInput: 'Budi',
    });

    await verifikasiBarangMasuk({ id: inputCrew.id, aksi: 'setujui', adminUserId: fx.adminId });

    const { rows } = await pool.query(`SELECT qty_delta FROM stok_ledger WHERE item_id = $1`, [fx.itemBiasaId]);
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].qty_delta), 15);
  });

  test('aksi TOLAK tidak menambah stok_ledger sama sekali', async () => {
    const inputCrew = await buatBarangMasukCrew({
      itemId: fx.itemBiasaId,
      gudangId: fx.gudangUgmId,
      jumlah: 15,
      satuan: 'Pack',
      fotoBuktiUrl: 'https://contoh.com/nota.jpg',
      deviceId: fx.deviceId,
      namaCrewInput: 'Budi',
    });

    await verifikasiBarangMasuk({ id: inputCrew.id, aksi: 'tolak', adminUserId: fx.adminId, catatan: 'Barang gak sesuai nota' });

    const { rows } = await pool.query(`SELECT * FROM stok_ledger WHERE item_id = $1`, [fx.itemBiasaId]);
    assert.equal(rows.length, 0);
  });

  test('aksi REVISI pakai jumlah baru, bukan jumlah asli dari Crew', async () => {
    const inputCrew = await buatBarangMasukCrew({
      itemId: fx.itemBiasaId,
      gudangId: fx.gudangUgmId,
      jumlah: 15,
      satuan: 'Pack',
      fotoBuktiUrl: 'https://contoh.com/nota.jpg',
      deviceId: fx.deviceId,
      namaCrewInput: 'Budi',
    });

    await verifikasiBarangMasuk({
      id: inputCrew.id,
      aksi: 'revisi',
      adminUserId: fx.adminId,
      jumlahRevisi: 12, // ternyata cuma 12, bukan 15
      catatan: 'Dihitung ulang, cuma 12',
    });

    const { rows } = await pool.query(`SELECT qty_delta FROM stok_ledger WHERE item_id = $1`, [fx.itemBiasaId]);
    assert.equal(Number(rows[0].qty_delta), 12);
  });

  test('DITOLAK kalau transaksi yang sama diverifikasi dua kali (race condition / double-click)', async () => {
    const inputCrew = await buatBarangMasukCrew({
      itemId: fx.itemBiasaId,
      gudangId: fx.gudangUgmId,
      jumlah: 15,
      satuan: 'Pack',
      fotoBuktiUrl: 'https://contoh.com/nota.jpg',
      deviceId: fx.deviceId,
      namaCrewInput: 'Budi',
    });

    await verifikasiBarangMasuk({ id: inputCrew.id, aksi: 'setujui', adminUserId: fx.adminId });

    await assert.rejects(
      () => verifikasiBarangMasuk({ id: inputCrew.id, aksi: 'setujui', adminUserId: fx.adminId }),
      (err) => {
        assert.equal(err.kode, 'TRANSAKSI_SUDAH_DIPROSES');
        return true;
      }
    );

    // pastiin juga stok_ledger cuma ke-insert SEKALI, bukan dobel
    const { rows } = await pool.query(`SELECT * FROM stok_ledger WHERE item_id = $1`, [fx.itemBiasaId]);
    assert.equal(rows.length, 1);
  });

  test('DITOLAK kalau foto bukti kosong (keputusan Q4: wajib tanpa kecuali)', async () => {
    await assert.rejects(
      () =>
        buatBarangMasukAdmin({
          itemId: fx.itemBiasaId,
          gudangId: fx.gudangUgmId,
          jumlah: 10,
          satuan: 'Pack',
          fotoBuktiUrl: '',
          adminUserId: fx.adminId,
        }),
      (err) => {
        assert.equal(err.kode, 'FOTO_BUKTI_WAJIB');
        return true;
      }
    );
  });
});
