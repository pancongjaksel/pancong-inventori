exports.up = (pgm) => {
  // Header nota — 1 nota bisa punya banyak item (beda dari transaksi_masuk lama
  // yang 1 baris = 1 item). transaksi_masuk lama TIDAK dihapus, dibiarkan sebagai
  // arsip historis; input baru semua lewat tabel nota+item ini.
  pgm.createTable('transaksi_masuk_nota', {
    id: 'id',
    gudang_id: { type: 'integer', notNull: true, references: 'gudang' },
    sumber: { type: 'varchar(150)' },
    foto_bukti_url: { type: 'text', notNull: true },
    diinput_oleh_role: { type: 'diinput_oleh_role_enum', notNull: true },
    diinput_oleh_user_id: { type: 'integer', references: 'users' },
    nama_crew_input: { type: 'varchar(100)' },
    status_verifikasi: { type: 'status_verifikasi_enum', notNull: true, default: 'terverifikasi' },
    label_status: { type: 'varchar(50)' },
    diverifikasi_oleh_user_id: { type: 'integer', references: 'users' },
    catatan_verifikasi: { type: 'text' },
    tanggal_verifikasi: { type: 'timestamptz' },
    tanggal: { type: 'date', notNull: true, default: pgm.func('CURRENT_DATE') },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('transaksi_masuk_nota', 'chk_nota_input_role_konsisten', {
    check: `
      (diinput_oleh_role = 'admin' AND diinput_oleh_user_id IS NOT NULL)
      OR
      (diinput_oleh_role = 'crew' AND nama_crew_input IS NOT NULL)
    `,
  });

  pgm.createIndex('transaksi_masuk_nota', 'status_verifikasi', {
    where: "status_verifikasi = 'menunggu'",
  });

  // Detail item per nota — banyak baris per nota_id.
  pgm.createTable('transaksi_masuk_item', {
    id: 'id',
    nota_id: { type: 'integer', notNull: true, references: 'transaksi_masuk_nota', onDelete: 'CASCADE' },
    item_id: { type: 'integer', notNull: true, references: 'item' },
    jumlah: { type: 'numeric(12,2)', notNull: true },
    satuan: { type: 'varchar(30)', notNull: true },
    harga_beli: { type: 'numeric(14,2)' },
  });

  pgm.addConstraint('transaksi_masuk_item', 'chk_item_jumlah_positif', {
    check: 'jumlah > 0',
  });

  // Trigger baru: begitu status_verifikasi nota berubah jadi 'terverifikasi',
  // loop semua item di nota itu, masing-masing masuk stok_ledger (sama logic
  // seperti trigger lama, cuma sekarang per-nota bukan per-baris transaksi).
  pgm.sql(`
    CREATE OR REPLACE FUNCTION fn_transaksi_masuk_nota_ke_ledger()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      IF NEW.status_verifikasi = 'terverifikasi'
         AND (TG_OP = 'INSERT' OR OLD.status_verifikasi IS DISTINCT FROM 'terverifikasi') THEN
        INSERT INTO stok_ledger (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
        SELECT tmi.item_id, NEW.gudang_id, 'masuk', tmi.jumlah, 'transaksi_masuk_nota', NEW.id, NEW.tanggal
        FROM transaksi_masuk_item tmi
        WHERE tmi.nota_id = NEW.id;
      END IF;
      RETURN NEW;
    END;
    $function$;
  `);

  pgm.sql(`
    CREATE TRIGGER trg_transaksi_masuk_nota_ke_ledger
    AFTER INSERT OR UPDATE OF status_verifikasi ON transaksi_masuk_nota
    FOR EACH ROW EXECUTE FUNCTION fn_transaksi_masuk_nota_ke_ledger();
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('transaksi_masuk_item');
  pgm.dropTable('transaksi_masuk_nota');
  pgm.sql('DROP FUNCTION IF EXISTS fn_transaksi_masuk_nota_ke_ledger() CASCADE;');
};
