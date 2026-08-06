/**
 * WAJIB di-require PALING ATAS di tiap file integration test, SEBELUM
 * require apa pun yang nyentuh db/pool (langsung atau lewat service lain) —
 * karena db/pool.js baca process.env.PG* pas modul itu pertama kali
 * di-load, bukan tiap query. Kalau load pool dulu baru env.test kebaca,
 * connection-nya bakal ke database yang salah.
 */
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../../.env.test') });

if (process.env.NODE_ENV !== 'test' || !process.env.PGDATABASE?.includes('test')) {
  throw new Error(
    'Integration test HARUS jalan dengan .env.test yang PGDATABASE-nya ' +
      'mengandung kata "test" (mis. pancong_inventori_test) — ini jaga-jaga ' +
      'biar gak ada yang gak sengaja jalanin test ke database production ' +
      'dan nge-TRUNCATE semua datanya.'
  );
}
