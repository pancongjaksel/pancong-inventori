exports.up = (pgm) => {
  pgm.sql(`
    UPDATE transfer_gudang
    SET status = 'ditolak'
    WHERE status = 'menunggu_approval' AND status_verifikasi = 'rejected';
  `);
};

exports.down = () => {};
