exports.up = (pgm) => {
  pgm.sql(`
    ALTER TYPE status_transfer_enum ADD VALUE IF NOT EXISTS 'ditolak';
  `);
};

exports.down = () => {
  // PostgreSQL tidak mendukung penghapusan value enum secara aman.
};
