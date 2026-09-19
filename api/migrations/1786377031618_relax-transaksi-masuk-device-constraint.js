exports.up = (pgm) => {
  // Redesign: device_gudang/device_admin_gudang gak lagi divalidasi per-row,
  // jadi diinput_oleh_device_id sekarang SELALU NULL untuk role crew. Constraint
  // lama mewajibkan NOT NULL untuk device_id di role crew — harus di-relax.
  pgm.dropConstraint('transaksi_masuk', 'chk_input_role_konsisten');
  pgm.addConstraint('transaksi_masuk', 'chk_input_role_konsisten', {
    check: `
      (diinput_oleh_role = 'admin' AND diinput_oleh_user_id IS NOT NULL)
      OR
      (diinput_oleh_role = 'crew' AND nama_crew_input IS NOT NULL)
    `,
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('transaksi_masuk', 'chk_input_role_konsisten');
  pgm.addConstraint('transaksi_masuk', 'chk_input_role_konsisten', {
    check: `
      (diinput_oleh_role = 'admin' AND diinput_oleh_user_id IS NOT NULL)
      OR
      (diinput_oleh_role = 'crew' AND diinput_oleh_device_id IS NOT NULL AND nama_crew_input IS NOT NULL)
    `,
  });
};
