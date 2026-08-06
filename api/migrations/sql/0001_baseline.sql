-- ============================================================================
-- SKEMA DATABASE — Aplikasi Inventori Terintegrasi Pancong Jaksel
-- Berdasarkan: PRD_Aplikasi_Inventori_Pancong_Jaksel_v3.md (v4.0)
-- Target: PostgreSQL 14+
-- ============================================================================
-- Prinsip desain:
-- 1. Tidak ada hard delete pada transaksi — hanya koreksi via entri pembalik.
-- 2. Stok gudang dihitung dari LEDGER terpusat (stok_ledger), bukan dijumlah
--    manual dari banyak tabel. Setiap kejadian yang mengubah stok gudang
--    menulis satu baris ke stok_ledger. Stok saat ini = SUM(qty_delta).
-- 3. Outlet TIDAK punya ledger stok sistem (sesuai PRD 5.6B) — stok outlet
--    cuma dibandingkan saat opname (Total Diterima vs Stok Fisik, kumulatif).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
CREATE TYPE tipe_gudang AS ENUM ('hub_admin_only', 'serving');
CREATE TYPE role_user AS ENUM ('owner', 'admin');
CREATE TYPE status_verifikasi_enum AS ENUM ('terverifikasi', 'menunggu', 'direvisi', 'ditolak');
CREATE TYPE diinput_oleh_role_enum AS ENUM ('admin', 'crew');
CREATE TYPE status_transfer_enum AS ENUM ('dikirim', 'diterima');
CREATE TYPE tipe_pergerakan_enum AS ENUM (
    'masuk',              -- barang masuk terverifikasi
    'keluar_ke_crew',      -- diambil crew ke outlet
    'transfer_keluar',     -- transfer dikirim (kurangi gudang asal)
    'transfer_masuk',      -- transfer diterima (tambah gudang tujuan)
    'produksi_keluar',     -- bahan terpakai produksi (Fase 2)
    'koreksi_reversal',    -- pembalik dari koreksi transaksi
    'opname_penyesuaian'   -- penyesuaian manual hasil opname gudang
);
CREATE TYPE tipe_lokasi_opname_enum AS ENUM ('gudang', 'outlet');
CREATE TYPE kategori_item_enum AS ENUM ('Bahan Adonan', 'Topping', 'Kemasan', 'Kebersihan');

-- ----------------------------------------------------------------------------
-- MASTER DATA
-- ----------------------------------------------------------------------------

CREATE TABLE gudang (
    id              SERIAL PRIMARY KEY,
    nama            VARCHAR(50) NOT NULL UNIQUE,   -- 'Produksi', 'Glagahsari', 'UGM'
    tipe            tipe_gudang NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE outlet (
    id              SERIAL PRIMARY KEY,
    nama            VARCHAR(50) NOT NULL UNIQUE,   -- Glagahsari, Pogung, Kaliurang, UGM, UMY, UAD
    gudang_asal_id  INTEGER NOT NULL REFERENCES gudang(id),
    aktif           BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE item (
    id                  SERIAL PRIMARY KEY,
    kode_barang         VARCHAR(20) NOT NULL UNIQUE,      -- BA-001, K-002, dst (dari Rekap SKU)
    nama                VARCHAR(100) NOT NULL,
    kategori            kategori_item_enum NOT NULL,
    satuan              VARCHAR(30) NOT NULL,
    accounting_code     VARCHAR(20),                      -- 5-1101 dst, mengikuti kategori
    status_aktif        BOOLEAN NOT NULL DEFAULT true,     -- Aktif / Tidak Bergerak
    gudang_default_id   INTEGER REFERENCES gudang(id),
    catatan_migrasi     TEXT,                              -- mis. catatan BA-004 nama/satuan kosong di jurnal lama
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aturan bisnis: outlet dilarang minta item kategori 'Bahan Adonan' kecuali BA-008 (Pandan Pasta)
-- (ditegakkan di application layer / trigger, dicatat di sini sebagai dokumentasi)

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    nama            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE,
    role            role_user NOT NULL,
    aktif           BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Catatan: Crew TIDAK punya baris di sini (tidak login per-akun, sesuai PRD Bagian 4).
-- Nama crew disimpan sebagai teks bebas di tabel transaksi masing-masing.

CREATE TABLE user_akses_gudang (
    user_id     INTEGER NOT NULL REFERENCES users(id),
    gudang_id   INTEGER NOT NULL REFERENCES gudang(id),
    PRIMARY KEY (user_id, gudang_id)
);
-- Admin biasanya punya baris untuk ketiga gudang (switch gudang dalam 1 akun).
-- Owner tidak perlu dibatasi di sini — akses semua gudang secara default di application layer.

-- Perangkat/device yang dipakai crew, terikat ke satu gudang (Produksi tidak
-- punya device karena tidak ada form Ambil Barang / Barang Masuk oleh crew di sana).
CREATE TABLE device_gudang (
    id              SERIAL PRIMARY KEY,
    nama_device     VARCHAR(50) NOT NULL,           -- mis. "HP Kasir Gudang UGM"
    gudang_id       INTEGER NOT NULL REFERENCES gudang(id),
    aktif           BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_device_bukan_produksi CHECK (true) -- validasi gudang.tipe='serving' dilakukan di app layer/trigger
);

-- ----------------------------------------------------------------------------
-- TRANSAKSI: BARANG MASUK (5.1 & 5.1b)
-- ----------------------------------------------------------------------------

CREATE TABLE transaksi_masuk (
    id                          SERIAL PRIMARY KEY,
    item_id                     INTEGER NOT NULL REFERENCES item(id),
    gudang_id                   INTEGER NOT NULL REFERENCES gudang(id),
    jumlah                      NUMERIC(12,2) NOT NULL CHECK (jumlah > 0),
    satuan                      VARCHAR(30) NOT NULL,
    harga_beli                  NUMERIC(14,2),                  -- opsional, untuk HPP
    sumber                      VARCHAR(150),                   -- nama supplier/asal
    foto_bukti_url              TEXT NOT NULL,                  -- wajib (keputusan Q4)
    diinput_oleh_role           diinput_oleh_role_enum NOT NULL,
    diinput_oleh_user_id        INTEGER REFERENCES users(id),   -- terisi kalau admin
    diinput_oleh_device_id      INTEGER REFERENCES device_gudang(id), -- terisi kalau crew
    nama_crew_input             VARCHAR(100),                   -- teks manual kalau diinput crew
    status_verifikasi           status_verifikasi_enum NOT NULL DEFAULT 'terverifikasi',
    label_status                VARCHAR(50),                    -- badge tampilan riwayat, mis. 'Ditolak Admin'
    diverifikasi_oleh_user_id   INTEGER REFERENCES users(id),
    catatan_verifikasi          TEXT,
    tanggal_verifikasi          TIMESTAMPTZ,
    tanggal                     DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_input_role_konsisten CHECK (
        (diinput_oleh_role = 'admin' AND diinput_oleh_user_id IS NOT NULL)
        OR
        (diinput_oleh_role = 'crew' AND diinput_oleh_device_id IS NOT NULL AND nama_crew_input IS NOT NULL)
    )
);
-- Trigger aplikasi: kalau diinput_oleh_role='admin' -> status_verifikasi default 'terverifikasi'
-- langsung tulis ke stok_ledger. Kalau 'crew' -> default 'menunggu', BELUM masuk ledger
-- sampai admin approve (lihat trigger trg_transaksi_masuk_ke_ledger di bawah).

-- ----------------------------------------------------------------------------
-- TRANSAKSI: DIAMBIL CREW (5.2) — sesi multi-item
-- ----------------------------------------------------------------------------

CREATE TABLE sesi_pengambilan_crew (
    id                  SERIAL PRIMARY KEY,
    nama_crew           VARCHAR(100) NOT NULL,          -- teks manual
    gudang_asal_id      INTEGER NOT NULL REFERENCES gudang(id),
    outlet_tujuan_id    INTEGER NOT NULL REFERENCES outlet(id),
    device_id           INTEGER REFERENCES device_gudang(id),
    tanggal             DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    -- validasi outlet_tujuan harus salah satu outlet yang gudang_asal_id-nya = gudang_asal_id sesi ini
    -- (ditegakkan via trigger, lihat trg_validasi_outlet_tujuan)
);

CREATE TABLE sesi_pengambilan_item (
    id          SERIAL PRIMARY KEY,
    sesi_id     INTEGER NOT NULL REFERENCES sesi_pengambilan_crew(id) ON DELETE CASCADE,
    item_id     INTEGER NOT NULL REFERENCES item(id),
    qty         NUMERIC(12,2) NOT NULL CHECK (qty > 0)
);

-- ----------------------------------------------------------------------------
-- TRANSFER ANTAR GUDANG (5.4) — 2 langkah: dikirim -> diterima
-- ----------------------------------------------------------------------------

CREATE TABLE transfer_gudang (
    id                  SERIAL PRIMARY KEY,
    item_id             INTEGER NOT NULL REFERENCES item(id),
    gudang_asal_id      INTEGER NOT NULL REFERENCES gudang(id),
    gudang_tujuan_id    INTEGER NOT NULL REFERENCES gudang(id),
    jumlah              NUMERIC(12,2) NOT NULL CHECK (jumlah > 0),
    status               status_transfer_enum NOT NULL DEFAULT 'dikirim',
    foto_bukti_kirim_url    TEXT NOT NULL,               -- wajib (keputusan Q4)
    foto_bukti_terima_url   TEXT,                        -- terisi saat status='diterima'
    dikirim_oleh_user_id    INTEGER NOT NULL REFERENCES users(id),   -- admin only
    diterima_oleh_user_id   INTEGER REFERENCES users(id),
    tanggal_kirim        TIMESTAMPTZ NOT NULL DEFAULT now(),
    tanggal_terima        TIMESTAMPTZ,
    CONSTRAINT chk_gudang_beda CHECK (gudang_asal_id <> gudang_tujuan_id)
);

-- ----------------------------------------------------------------------------
-- KOREKSI / PEMBATALAN TRANSAKSI (5.3) — audit trail, tanpa hard delete
-- ----------------------------------------------------------------------------

CREATE TABLE koreksi_transaksi (
    id                      SERIAL PRIMARY KEY,
    tabel_transaksi         VARCHAR(50) NOT NULL,   -- 'transaksi_masuk' | 'sesi_pengambilan_crew' | 'transfer_gudang'
    transaksi_asal_id       INTEGER NOT NULL,
    alasan                  TEXT NOT NULL,
    oleh_user_id            INTEGER NOT NULL REFERENCES users(id),  -- admin only
    entri_pembalik_ledger_id INTEGER,                -- FK diisi setelah stok_ledger reversal dibuat
    tanggal                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- LEDGER STOK TERPUSAT — single source of truth stok gudang
-- ----------------------------------------------------------------------------

CREATE TABLE stok_ledger (
    id                  BIGSERIAL PRIMARY KEY,
    item_id             INTEGER NOT NULL REFERENCES item(id),
    gudang_id           INTEGER NOT NULL REFERENCES gudang(id),
    tipe_pergerakan     tipe_pergerakan_enum NOT NULL,
    qty_delta           NUMERIC(12,2) NOT NULL,        -- positif = nambah stok, negatif = kurangi
    referensi_tabel     VARCHAR(50) NOT NULL,          -- nama tabel sumber kejadian
    referensi_id        INTEGER NOT NULL,              -- id baris di tabel sumber
    tanggal              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stok_ledger_item_gudang ON stok_ledger(item_id, gudang_id);
CREATE INDEX idx_stok_ledger_referensi ON stok_ledger(referensi_tabel, referensi_id);

-- View: stok gudang saat ini (real-time, Bagian 2 tujuan produk)
CREATE VIEW v_stok_gudang_saat_ini AS
SELECT
    g.id AS gudang_id,
    g.nama AS nama_gudang,
    i.id AS item_id,
    i.kode_barang,
    i.nama AS nama_item,
    i.satuan,
    COALESCE(SUM(sl.qty_delta), 0) AS stok_saat_ini
FROM gudang g
CROSS JOIN item i
LEFT JOIN stok_ledger sl ON sl.gudang_id = g.id AND sl.item_id = i.id
GROUP BY g.id, g.nama, i.id, i.kode_barang, i.nama, i.satuan;

-- ----------------------------------------------------------------------------
-- PRODUKSI & BOM (Fase 2 — resep campuran: baseline + override aktual)
-- ----------------------------------------------------------------------------

CREATE TABLE resep_bom (
    id              SERIAL PRIMARY KEY,
    nama_produk     VARCHAR(100) NOT NULL,
    aktif           BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE resep_bahan (
    id              SERIAL PRIMARY KEY,
    resep_id        INTEGER NOT NULL REFERENCES resep_bom(id) ON DELETE CASCADE,
    item_id         INTEGER NOT NULL REFERENCES item(id),
    qty_baseline    NUMERIC(12,4) NOT NULL CHECK (qty_baseline > 0)
);

CREATE TABLE transaksi_produksi (
    id              SERIAL PRIMARY KEY,
    resep_id        INTEGER NOT NULL REFERENCES resep_bom(id),
    gudang_id       INTEGER NOT NULL REFERENCES gudang(id),  -- biasanya Gudang Produksi
    jumlah_batch    NUMERIC(10,2) NOT NULL CHECK (jumlah_batch > 0),
    dicatat_oleh_user_id INTEGER NOT NULL REFERENCES users(id),
    tanggal         DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transaksi_produksi_bahan (
    id                      SERIAL PRIMARY KEY,
    transaksi_produksi_id   INTEGER NOT NULL REFERENCES transaksi_produksi(id) ON DELETE CASCADE,
    item_id                 INTEGER NOT NULL REFERENCES item(id),
    qty_bom                 NUMERIC(12,4) NOT NULL,   -- hasil kali qty_baseline x jumlah_batch (snapshot)
    qty_aktual              NUMERIC(12,4) NOT NULL,   -- bisa berbeda dari qty_bom (override)
    catatan_override        TEXT
);

-- ----------------------------------------------------------------------------
-- STOK OPNAME (5.6) — gudang & outlet, kumulatif antar-periode
-- ----------------------------------------------------------------------------

CREATE TABLE stok_opname (
    id                          SERIAL PRIMARY KEY,
    lokasi_tipe                 tipe_lokasi_opname_enum NOT NULL,
    gudang_id                   INTEGER REFERENCES gudang(id),   -- terisi kalau lokasi_tipe='gudang'
    outlet_id                   INTEGER REFERENCES outlet(id),   -- terisi kalau lokasi_tipe='outlet'
    item_id                     INTEGER NOT NULL REFERENCES item(id),
    periode                     VARCHAR(7) NOT NULL,             -- format 'YYYY-MM'
    stok_awal_periode           NUMERIC(12,2) NOT NULL DEFAULT 0, -- carry-over dari stok_fisik periode lalu (khusus outlet)
    stok_sistem_atau_diterima   NUMERIC(12,2) NOT NULL,          -- gudang: stok_ledger saat opname; outlet: total diterima periode ini
    stok_fisik                  NUMERIC(12,2) NOT NULL,
    selisih                     NUMERIC(12,2) GENERATED ALWAYS AS (
        (stok_awal_periode + stok_sistem_atau_diterima) - stok_fisik
    ) STORED,
    dicatat_oleh_user_id         INTEGER NOT NULL REFERENCES users(id),
    tanggal                      DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_lokasi_konsisten CHECK (
        (lokasi_tipe = 'gudang' AND gudang_id IS NOT NULL AND outlet_id IS NULL)
        OR
        (lokasi_tipe = 'outlet' AND outlet_id IS NOT NULL AND gudang_id IS NULL)
    ),
    CONSTRAINT uq_opname_periode UNIQUE (lokasi_tipe, gudang_id, outlet_id, item_id, periode)
);
-- Catatan: untuk lokasi_tipe='gudang', stok_awal_periode dibiarkan 0 dan
-- stok_sistem_atau_diterima = snapshot v_stok_gudang_saat_ini saat opname dibuat
-- (opname gudang TIDAK kumulatif, cuma dibandingkan ke stok sistem saat itu — beda
-- dengan opname outlet yang kumulatif sesuai keputusan Q2).

-- ============================================================================
-- TRIGGER: dorong perubahan stok gudang ke stok_ledger secara otomatis
-- ============================================================================

-- 1) Barang Masuk -> ledger, HANYA kalau status_verifikasi = 'terverifikasi'
CREATE OR REPLACE FUNCTION fn_transaksi_masuk_ke_ledger() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status_verifikasi = 'terverifikasi'
       AND (TG_OP = 'INSERT' OR OLD.status_verifikasi IS DISTINCT FROM 'terverifikasi') THEN
        INSERT INTO stok_ledger (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
        VALUES (NEW.item_id, NEW.gudang_id, 'masuk', NEW.jumlah, 'transaksi_masuk', NEW.id, NEW.tanggal);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transaksi_masuk_ke_ledger
AFTER INSERT OR UPDATE OF status_verifikasi ON transaksi_masuk
FOR EACH ROW EXECUTE FUNCTION fn_transaksi_masuk_ke_ledger();

-- 2) Sesi Pengambilan Crew -> ledger keluar (per baris item dalam sesi)
CREATE OR REPLACE FUNCTION fn_pengambilan_item_ke_ledger() RETURNS TRIGGER AS $$
DECLARE
    v_gudang_id INTEGER;
    v_tanggal   DATE;
BEGIN
    SELECT gudang_asal_id, tanggal INTO v_gudang_id, v_tanggal
    FROM sesi_pengambilan_crew WHERE id = NEW.sesi_id;

    INSERT INTO stok_ledger (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
    VALUES (NEW.item_id, v_gudang_id, 'keluar_ke_crew', -NEW.qty, 'sesi_pengambilan_item', NEW.id, v_tanggal);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pengambilan_item_ke_ledger
AFTER INSERT ON sesi_pengambilan_item
FOR EACH ROW EXECUTE FUNCTION fn_pengambilan_item_ke_ledger();

-- 3) Transfer Gudang -> ledger keluar saat 'dikirim' (INSERT), ledger masuk saat status berubah ke 'diterima'
CREATE OR REPLACE FUNCTION fn_transfer_ke_ledger() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO stok_ledger (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
        VALUES (NEW.item_id, NEW.gudang_asal_id, 'transfer_keluar', -NEW.jumlah, 'transfer_gudang', NEW.id, NEW.tanggal_kirim);
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'diterima' AND OLD.status = 'dikirim' THEN
        INSERT INTO stok_ledger (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
        VALUES (NEW.item_id, NEW.gudang_tujuan_id, 'transfer_masuk', NEW.jumlah, 'transfer_gudang', NEW.id, NEW.tanggal_terima);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transfer_ke_ledger
AFTER INSERT OR UPDATE OF status ON transfer_gudang
FOR EACH ROW EXECUTE FUNCTION fn_transfer_ke_ledger();

-- 4) Produksi (Fase 2) -> ledger keluar bahan terpakai aktual
CREATE OR REPLACE FUNCTION fn_produksi_bahan_ke_ledger() RETURNS TRIGGER AS $$
DECLARE
    v_gudang_id INTEGER;
    v_tanggal   DATE;
BEGIN
    SELECT gudang_id, tanggal INTO v_gudang_id, v_tanggal
    FROM transaksi_produksi WHERE id = NEW.transaksi_produksi_id;

    INSERT INTO stok_ledger (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
    VALUES (NEW.item_id, v_gudang_id, 'produksi_keluar', -NEW.qty_aktual, 'transaksi_produksi_bahan', NEW.id, v_tanggal);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_produksi_bahan_ke_ledger
AFTER INSERT ON transaksi_produksi_bahan
FOR EACH ROW EXECUTE FUNCTION fn_produksi_bahan_ke_ledger();

-- Catatan implementasi (bukan trigger DB, dilakukan di application layer):
-- - Koreksi transaksi (5.3): saat admin approve koreksi, aplikasi INSERT baris baru
--   ke stok_ledger dengan tipe_pergerakan='koreksi_reversal' dan qty_delta lawan dari
--   entri asal, lalu update koreksi_transaksi.entri_pembalik_ledger_id.
--   (Sengaja tidak di-trigger otomatis karena butuh keputusan admin, bukan reaksi ke INSERT.)

-- ============================================================================
-- TRIGGER VALIDASI BISNIS
-- ============================================================================

-- 5) Validasi: outlet_tujuan sebuah sesi pengambilan crew harus outlet yang memang
--    dilayani oleh gudang_asal_id sesi tersebut (Bagian 3 — UGM device cuma boleh
--    kirim ke {UGM, Pogung, Kaliurang}; Glagahsari device cuma ke {Glagahsari, UMY, UAD}).
--    Ini jaga-jaga di level DB kalau ada bug di frontend yang lolos filter dropdown.
CREATE OR REPLACE FUNCTION fn_validasi_outlet_tujuan() RETURNS TRIGGER AS $$
DECLARE
    v_gudang_asal_outlet INTEGER;
    v_nama_outlet        VARCHAR;
BEGIN
    SELECT gudang_asal_id, nama INTO v_gudang_asal_outlet, v_nama_outlet
    FROM outlet
    WHERE id = NEW.outlet_tujuan_id;

    IF v_gudang_asal_outlet IS NULL THEN
        RAISE EXCEPTION 'Outlet tujuan id % tidak ditemukan', NEW.outlet_tujuan_id;
    END IF;

    IF v_gudang_asal_outlet <> NEW.gudang_asal_id THEN
        RAISE EXCEPTION 'Outlet "%" tidak dilayani oleh gudang_id=%. Outlet ini seharusnya diambil dari gudang_id=%.',
            v_nama_outlet, NEW.gudang_asal_id, v_gudang_asal_outlet;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validasi_outlet_tujuan
BEFORE INSERT OR UPDATE OF outlet_tujuan_id, gudang_asal_id ON sesi_pengambilan_crew
FOR EACH ROW EXECUTE FUNCTION fn_validasi_outlet_tujuan();

-- 6) Validasi: outlet dilarang mengambil item kategori 'Bahan Adonan', kecuali
--    BA-008 (Pandan Pasta). Dicek per baris item saat ditambahkan ke sesi pengambilan.
CREATE OR REPLACE FUNCTION fn_validasi_larangan_bahan_adonan() RETURNS TRIGGER AS $$
DECLARE
    v_kategori    kategori_item_enum;
    v_kode_barang VARCHAR;
    v_nama_item   VARCHAR;
BEGIN
    SELECT kategori, kode_barang, nama INTO v_kategori, v_kode_barang, v_nama_item
    FROM item
    WHERE id = NEW.item_id;

    IF v_kategori = 'Bahan Adonan' AND v_kode_barang <> 'BA-008' THEN
        RAISE EXCEPTION 'Item "%" (kode %) adalah Bahan Adonan dan tidak boleh diambil ke outlet — kecuali BA-008 Pandan Pasta.',
            v_nama_item, v_kode_barang;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validasi_larangan_bahan_adonan
BEFORE INSERT ON sesi_pengambilan_item
FOR EACH ROW EXECUTE FUNCTION fn_validasi_larangan_bahan_adonan();

-- 7) Validasi: device_gudang tidak boleh terikat ke gudang bertipe 'hub_admin_only'
--    (Gudang Produksi tidak punya form Ambil Barang / Barang Masuk versi crew).
CREATE OR REPLACE FUNCTION fn_validasi_device_bukan_produksi() RETURNS TRIGGER AS $$
DECLARE
    v_tipe_gudang tipe_gudang;
    v_nama_gudang VARCHAR;
BEGIN
    SELECT tipe, nama INTO v_tipe_gudang, v_nama_gudang
    FROM gudang
    WHERE id = NEW.gudang_id;

    IF v_tipe_gudang = 'hub_admin_only' THEN
        RAISE EXCEPTION 'Gudang "%" adalah hub admin-only, tidak boleh punya device_gudang untuk crew.', v_nama_gudang;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validasi_device_bukan_produksi
BEFORE INSERT OR UPDATE OF gudang_id ON device_gudang
FOR EACH ROW EXECUTE FUNCTION fn_validasi_device_bukan_produksi();

-- 8) Validasi: transfer_gudang.dikirim_oleh_user_id dan diterima_oleh_user_id
--    harus role='admin' (Owner secara bisnis tidak melakukan transfer harian,
--    tapi tidak diblokir di DB — cukup jaga agar bukan role lain kalau nanti
--    ditambah role baru). Dicek longgar: user tsb harus terdaftar & aktif.
CREATE OR REPLACE FUNCTION fn_validasi_user_aktif_transfer() RETURNS TRIGGER AS $$
DECLARE
    v_aktif BOOLEAN;
BEGIN
    SELECT aktif INTO v_aktif FROM users WHERE id = NEW.dikirim_oleh_user_id;
    IF v_aktif IS NULL OR v_aktif = false THEN
        RAISE EXCEPTION 'User pengirim transfer (id=%) tidak ditemukan atau tidak aktif.', NEW.dikirim_oleh_user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validasi_user_aktif_transfer
BEFORE INSERT ON transfer_gudang
FOR EACH ROW EXECUTE FUNCTION fn_validasi_user_aktif_transfer();

-- ============================================================================
-- KOLOM TAMBAHAN — label_status untuk sesi_pengambilan_crew & transfer_gudang
-- ============================================================================
-- transaksi_masuk sudah punya label_status dari awal (buat badge 'Ditolak
-- Admin' / 'Direvisi Admin'). Dua tabel ini ditambah kolom yang sama supaya
-- badge 'Dikoreksi' (PRD 5.3) bisa ditampilkan konsisten di riwayat gudang,
-- tanpa perlu join manual ke koreksi_transaksi tiap kali render UI.
ALTER TABLE sesi_pengambilan_crew ADD COLUMN label_status VARCHAR(50);
ALTER TABLE transfer_gudang ADD COLUMN label_status VARCHAR(50);

CREATE INDEX idx_transaksi_masuk_status ON transaksi_masuk(status_verifikasi) WHERE status_verifikasi = 'menunggu';
CREATE INDEX idx_sesi_pengambilan_tanggal ON sesi_pengambilan_crew(tanggal);
CREATE INDEX idx_transfer_status ON transfer_gudang(status) WHERE status = 'dikirim';
CREATE INDEX idx_stok_opname_periode ON stok_opname(periode);
