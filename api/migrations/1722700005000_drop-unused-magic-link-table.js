/**
 * Tabel magic_link_token adalah sisa dari draf auth sebelum keputusan final
 * (kita pakai email+password, bukan magic link — lihat migration
 * add-auth-password). Tabel ini gak pernah dipakai kode manapun, aman
 * dihapus. Ini migration TERPISAH (bukan edit baseline) karena baseline
 * udah kadung dijalankan di database production/dev kamu.
 */
exports.up = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS magic_link_token;`);
};

exports.down = (pgm) => {
  // Sengaja gak di-recreate di 'down' — tabel ini emang gak dipakai,
  // gak ada gunanya dikembaliin.
  pgm.sql(`-- tidak ada aksi, tabel ini memang tidak dipakai`);
};
