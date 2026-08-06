const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { TABEL_VALID } = require('../../validators/koreksiTransaksiValidator');

describe('koreksiTransaksiValidator.TABEL_VALID', () => {
  test('cuma 3 tabel yang boleh dikoreksi', () => {
    assert.deepEqual(
      [...TABEL_VALID].sort(),
      ['sesi_pengambilan_crew', 'transaksi_masuk', 'transfer_gudang'].sort()
    );
  });

  test('koreksi_transaksi sendiri TIDAK ada di daftar (gak boleh koreksi koreksi)', () => {
    assert.ok(!TABEL_VALID.includes('koreksi_transaksi'));
  });
});

// Catatan: validasiSebelumKoreksi() gak dites di sini karena butuh koneksi DB
// (query ke stok_ledger, cek transaksi asal, dst) — dites di
// tests/integration/koreksiTransaksi.test.js.
