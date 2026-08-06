const fs = require('fs');
const path = require('path');

/**
 * Migration baseline — isinya skema awal lengkap (tabel, enum, trigger, view,
 * index) yang sebelumnya ada di skema_database_inventori_pancong_jaksel.sql.
 * File SQL aslinya disalin ke migrations/sql/0001_baseline.sql supaya
 * migration ini gampang dibaca (bukan 1 file JS raksasa berisi string SQL
 * ratusan baris).
 *
 * Perubahan skema SETELAH ini harus lewat migration baru (`npm run
 * migrate:create -- nama_perubahan`), JANGAN edit file 0001_baseline.sql.
 */
exports.up = (pgm) => {
  const sql = fs.readFileSync(path.join(__dirname, 'sql', '0001_baseline.sql'), 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  // Down dari baseline sengaja "nuke & pave" — bukan DROP satu-satu tabel
  // (urutan DROP karena FK bakal ribet & gampang salah urutan). Ini cuma
  // dipakai di environment development untuk reset total, JANGAN pernah
  // dijalankan di production.
  pgm.sql('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
};
