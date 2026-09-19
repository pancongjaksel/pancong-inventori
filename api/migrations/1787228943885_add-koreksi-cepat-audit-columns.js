exports.up = (pgm) => {
  // Audit trail buat fitur Edit Cepat Pengambilan Crew — qty_asli disimpan cuma
  // sekali (pas pertama kali dikoreksi), dikoreksi_oleh/dikoreksi_at nunjukin
  // siapa & kapan terakhir kali diedit lewat endpoint koreksi-cepat-item.
  pgm.addColumn('sesi_pengambilan_item', {
    qty_asli: { type: 'numeric(12,2)' },
    dikoreksi_oleh: { type: 'text' },
    dikoreksi_at: { type: 'timestamptz' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('sesi_pengambilan_item', ['qty_asli', 'dikoreksi_oleh', 'dikoreksi_at']);
};
