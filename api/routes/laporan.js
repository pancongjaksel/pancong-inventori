const express = require('express');
const { onItemDikoreksiCepat } = require('../services/aktivitasPengambilanService');
const { getLaporanBelanjaBulanan, generateLaporanBelanjaBulananExcel } = require('../services/laporanBelanjaService');
const { pool } = require('../db/pool');
const { requireAdmin, requireAdminOrGudang } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/laporan/belanja-bulanan?periode=YYYY-MM&gudang_id=
 * Hanya penerimaan yang telah terverifikasi dan belum dibatalkan formal.
 */
router.get('/belanja-bulanan', requireAdminOrGudang, async (req, res, next) => {
  try {
    const hasil = await getLaporanBelanjaBulanan({
      periode: req.query.periode,
      gudangId: req.query.gudang_id,
    });
    res.status(200).json({ sukses: true, data: hasil });
  } catch (err) {
    next(err);
  }
});

/** GET /api/laporan/belanja-bulanan/export?periode=YYYY-MM&gudang_id= */
router.get('/belanja-bulanan/export', requireAdminOrGudang, async (req, res, next) => {
  try {
    const { workbook } = await generateLaporanBelanjaBulananExcel({
      periode: req.query.periode,
      gudangId: req.query.gudang_id,
    });
    const suffixGudang = req.query.gudang_id ? `-Gudang-${req.query.gudang_id}` : '-Semua-Gudang';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Laporan-Belanja-${req.query.periode}${suffixGudang}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/laporan/stok-gudang?gudangId=
 * Snapshot stok real-time semua gudang (atau 1 gudang kalau di-filter),
 * dari view v_stok_gudang_saat_ini. Dipakai Dashboard.jsx (home admin).
 * Item kategori Bahan Adonan cuma relevan di gudang default-nya (Produksi) —
 * sama persis logic yang dipakai /stok-saat-ini. Kalau gudangId kosong
 * (mode "Semua Gudang"), gak ada filter tambahan ini.
 */
router.get('/stok-gudang', requireAdmin, async (req, res, next) => {
  try {
    const { gudangId } = req.query;
    const { rows } = await pool.query(
      `SELECT v.*
       FROM v_stok_gudang_saat_ini v
       JOIN item i ON i.id = v.item_id
       WHERE i.status_aktif = true
         AND ($1::int IS NULL OR v.gudang_id = $1)
         AND (
           $1::int IS NULL
           OR (
             $1::int = 1 AND (
               i.kategori = 'Bahan Adonan'
               OR i.selalu_tampil_semua_gudang = true
               OR v.stok_saat_ini > 0
             )
           )
           OR (
             $1::int != 1 AND (
               i.kategori != 'Bahan Adonan'
               OR i.selalu_tampil_semua_gudang = true
             )
           )
         )
       ORDER BY v.nama_gudang, v.nama_item`,
      [gudangId || null]
    );
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/laporan/stok-menipis
 * Item yang stok-nya di bawah reorder_point (dari view v_stok_menipis).
 * Item dengan reorder_point belum di-set (NULL) otomatis gak pernah muncul.
 *
 * Endpoint ini gak nerima gudang_id (selalu system-wide, dipakai Dashboard.jsx
 * yang nampilin alert lepas dari tab gudang mana yang lagi dipilih) — jadi
 * filter Bahan Adonan-nya beda mekanisme dari stok-saat-ini/stok-gudang:
 * bukan dibandingkan ke gudang yang DIMINTA, tapi ke gudang SENDIRI tiap
 * baris (vm.gudang_id) — buang baris Bahan Adonan yang nongol di gudang lain
 * selain gudang_default_id-nya (kecuali item pengecualian).
 */
router.get('/stok-menipis', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT vm.*
      FROM v_stok_menipis vm
      JOIN item i ON i.id = vm.item_id
      WHERE i.status_aktif = true
        AND (
          (vm.gudang_id = 1 AND (
            i.kategori = 'Bahan Adonan'
            OR i.selalu_tampil_semua_gudang = true
          ))
          OR (vm.gudang_id != 1 AND (
            i.kategori != 'Bahan Adonan'
            OR i.selalu_tampil_semua_gudang = true
          ))
        )
      ORDER BY vm.nama_gudang, vm.nama_item
    `);
    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/laporan/stok-saat-ini?gudang_id=&search=
 * Snapshot stok real-time per item x gudang (item aktif saja), dari view
 * v_stok_gudang_saat_ini, ditambah flag stok_menipis/stok_negatif dan
 * filter opsional gudang/nama item.
 * requireAdminOrGudang (bukan requireAdmin) karena StokOpname.jsx (dipakai juga
 * sebagai halaman utama sesi device Admin Gudang) manggil endpoint ini buat
 * nampilin kolom "Stok Sistem" live pas opname gudang.
 * Item kategori Bahan Adonan cuma relevan di gudang default-nya (Produksi) —
 * kalau gudang_id diisi & beda dari gudang_default_id item itu, item itu
 * disembunyikan (kecuali selalu_tampil_semua_gudang=true, mis. Pandan Pasta).
 * Kalau gudang_id kosong (mode "Semua Gudang"), gak ada filter tambahan ini.
 */
router.get('/stok-saat-ini', requireAdminOrGudang, async (req, res, next) => {
  try {
    const { gudang_id, search } = req.query;

    const { rows } = await pool.query(
      `SELECT
         v.gudang_id,
         v.nama_gudang,
         v.item_id,
         v.kode_barang,
         v.nama_item,
         v.satuan,
         v.stok_saat_ini,
         i.reorder_point,
         (i.reorder_point IS NOT NULL AND v.stok_saat_ini <= i.reorder_point) AS stok_menipis,
         (v.stok_saat_ini < 0) AS stok_negatif
       FROM v_stok_gudang_saat_ini v
       JOIN item i ON i.id = v.item_id
       WHERE i.status_aktif = true
         AND ($1::int IS NULL OR v.gudang_id = $1)
         AND ($2::text IS NULL OR v.nama_item ILIKE '%' || $2 || '%')
         AND (
           $1::int IS NULL
           OR (
             $1::int = 1 AND (
               i.kategori = 'Bahan Adonan'
               OR i.selalu_tampil_semua_gudang = true
               OR v.stok_saat_ini > 0
             )
           )
           OR (
             $1::int != 1 AND (
               i.kategori != 'Bahan Adonan'
               OR i.selalu_tampil_semua_gudang = true
             )
           )
         )
       ORDER BY v.nama_gudang, v.nama_item`,
      [gudang_id || null, search || null]
    );

    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/laporan/sesi-pengambilan-terbaru?dari_tanggal=&sampai_tanggal=
 * Sesi pengambilan crew dengan detail item lengkap, dipakai buat notifikasi
 * bell + Edit Cepat. Default rentang: awal bulan ini s/d hari ini (biar admin
 * gudang bisa pantau ke belakang, bukan cuma 20 terbaru). LIMIT 200 tetap
 * dipasang sebagai batas aman, bukan buat membatasi rentang tanggal.
 * Sesi Dikoreksi sengaja tidak di-exclude — admin tetap bisa lihat histori
 * lengkap buat referensi/audit; guard sudah ada di /koreksi-cepat-item.
 */
router.get('/sesi-pengambilan-terbaru', requireAdminOrGudang, async (req, res, next) => {
  try {
    const { dari_tanggal, sampai_tanggal } = req.query;

    const { rows } = await pool.query(`
      SELECT
        sp.id as sesi_id,
        sp.gudang_asal_id,
        g.nama as gudang_nama,
        sp.tanggal,
        sp.created_at,
        sp.nama_crew,
        sp.label_status,
        json_agg(
          json_build_object(
            'sesi_pengambilan_item_id', spi.id,
            'item_id', spi.item_id,
            'item_nama', i.nama,
            'qty', spi.qty,
            'satuan', i.satuan,
            'qty_asli', spi.qty_asli,
            'dikoreksi_oleh', spi.dikoreksi_oleh,
            'dikoreksi_at', spi.dikoreksi_at
          ) ORDER BY i.nama
        ) as items
      FROM sesi_pengambilan_crew sp
      LEFT JOIN gudang g ON g.id = sp.gudang_asal_id
      LEFT JOIN sesi_pengambilan_item spi ON spi.sesi_id = sp.id
      LEFT JOIN item i ON i.id = spi.item_id
      WHERE sp.tanggal >= COALESCE($1::date, date_trunc('month', CURRENT_DATE))
        AND sp.tanggal <= COALESCE($2::date, CURRENT_DATE)
      GROUP BY sp.id, sp.gudang_asal_id, g.nama, sp.tanggal, sp.created_at, sp.nama_crew, sp.label_status
      ORDER BY sp.created_at DESC
      LIMIT 200
    `, [dari_tanggal || null, sampai_tanggal || null]);

    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/laporan/pengambilan-per-outlet?outlet_id=&dari_tanggal=&sampai_tanggal=
 * Total qty per item yang sudah diambil sebuah outlet, dalam rentang tanggal.
 * Pakai qty SEKARANG (setelah Edit Cepat kalau ada) — bukan qty_asli — karena
 * itu yang paling akurat merefleksikan barang yang benar-benar keluar.
 *
 * Sesi berstatus label_status='Dikoreksi' di-exclude: seluruh sesi itu sudah
 * dibalik lewat koreksi_reversal di ledger, qty di sesi_pengambilan_item-nya
 * tetap angka lama yang salah (reversal tidak mengupdate baris sesi).
 * Dikonfirmasi dari data: semua 10 sesi Dikoreksi punya alasan sah (data dummy,
 * double entry, salah input) dan TIDAK mencerminkan pengambilan fisik nyata.
 *
 * Tidak di-scope per-gudang: /master/outlets untuk device token sudah otomatis
 * memfilter ke outlet milik gudang device itu, jadi dropdown outlet di frontend
 * admin gudang sudah terbatas — tidak perlu filter tambahan di sini.
 */
router.get('/pengambilan-per-outlet', requireAdminOrGudang, async (req, res, next) => {
  try {
    const { outlet_id, dari_tanggal, sampai_tanggal } = req.query;

    if (!outlet_id) {
      return res.status(400).json({ sukses: false, kode: 'OUTLET_ID_WAJIB', pesan: 'outlet_id wajib diisi.' });
    }

    const { rows } = await pool.query(
      `SELECT
         si.item_id,
         i.kode_barang,
         i.nama AS nama_item,
         i.satuan,
         i.harga,
         SUM(si.qty) AS total_qty,
         (SUM(si.qty) * i.harga)::INTEGER AS subtotal
       FROM sesi_pengambilan_crew sp
       JOIN sesi_pengambilan_item si ON si.sesi_id = sp.id
       JOIN item i ON i.id = si.item_id
       WHERE sp.outlet_tujuan_id = $1
         AND ($2::date IS NULL OR sp.tanggal >= $2)
         AND ($3::date IS NULL OR sp.tanggal <= $3)
         AND COALESCE(sp.label_status, 'normal') != 'Dikoreksi'
       GROUP BY si.item_id, i.kode_barang, i.nama, i.satuan, i.harga
       ORDER BY i.nama`,
      [outlet_id, dari_tanggal || null, sampai_tanggal || null]
    );

    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/laporan/koreksi-cepat-item
 * Edit cepat qty sebuah baris sesi_pengambilan_item + ledger terkait, dari
 * notifikasi real-time. TIGA guard wajib (lihat diskusi 2026-08-20):
 * 1. Sesi yang sudah diformalkan lewat Koreksi Transaksi (label_status =
 *    'Dikoreksi') diblokir total — ledger aslinya sudah "mati" (dinetralkan
 *    lewat baris reversal terpisah), ngedit qty di sini bakal menghidupkan
 *    lagi efek transaksi yang seharusnya sudah nggak berlaku.
 * 2. Baris ledger dicari spesifik tipe_pergerakan='keluar_ke_crew' & harus
 *    PERSIS 1 baris — 0 atau >1 baris nunjukin data nggak konsisten, jangan
 *    asal ambil baris pertama (itu persis kelas bug yang bikin kasus
 *    double-counting Kresek Bening kemarin).
 * 3. qty_baru divalidasi >0 sebelum kena query sama sekali.
 */
router.patch('/koreksi-cepat-item', requireAdminOrGudang, async (req, res, next) => {
  const { sesi_pengambilan_item_id, qty_baru, konfirmasi_meski_ada_opname } = req.body;

  const qtyBaruNum = Number(qty_baru);
  if (!Number.isFinite(qtyBaruNum) || qtyBaruNum <= 0) {
    return res.status(400).json({ sukses: false, kode: 'QTY_TIDAK_VALID', pesan: 'qty_baru harus angka lebih besar dari 0.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemRes = await client.query(`
      SELECT spi.id, spi.item_id, spi.qty, spi.qty_asli, sp.gudang_asal_id, sp.tanggal, sp.label_status
      FROM sesi_pengambilan_item spi
      JOIN sesi_pengambilan_crew sp ON sp.id = spi.sesi_id
      WHERE spi.id = $1
    `, [sesi_pengambilan_item_id]);

    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ sukses: false, kode: 'ITEM_TIDAK_DITEMUKAN', pesan: 'Item pengambilan tidak ditemukan.' });
    }
    const item = itemRes.rows[0];

    if (item.label_status === 'Dikoreksi') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        sukses: false,
        kode: 'SESI_SUDAH_DIKOREKSI',
        pesan: 'Sesi ini sudah dikoreksi lewat Koreksi Transaksi, tidak bisa diedit lewat sini.',
      });
    }

    // Safety check: ada opname_penyesuaian setelah tanggal sesi ini untuk item+gudang yang sama?
    const opnameCheck = await client.query(`
      SELECT so.id, so.tanggal
      FROM stok_opname so
      WHERE so.item_id = $1 AND so.gudang_id = $2 AND so.tanggal >= $3
      ORDER BY so.tanggal DESC LIMIT 1
    `, [item.item_id, item.gudang_asal_id, item.tanggal]);

    if (opnameCheck.rows.length > 0 && !konfirmasi_meski_ada_opname) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        sukses: false,
        kode: 'PERLU_KONFIRMASI_OPNAME',
        peringatan: true,
        pesan: `Item ini sudah direkonsiliasi lewat stok opname tanggal ${opnameCheck.rows[0].tanggal}. Mengoreksi sekarang bisa menyebabkan double-counting.`,
        opname_id: opnameCheck.rows[0].id,
      });
    }

    const ledgerRes = await client.query(`
      SELECT id, qty_delta FROM stok_ledger
      WHERE referensi_tabel = 'sesi_pengambilan_item'
        AND referensi_id = $1
        AND tipe_pergerakan = 'keluar_ke_crew'
    `, [sesi_pengambilan_item_id]);

    if (ledgerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ sukses: false, kode: 'LEDGER_TIDAK_DITEMUKAN', pesan: 'Baris ledger terkait tidak ditemukan.' });
    }
    if (ledgerRes.rows.length > 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        sukses: false,
        kode: 'LEDGER_TIDAK_KONSISTEN',
        pesan: `Data ledger tidak konsisten: ditemukan ${ledgerRes.rows.length} baris keluar_ke_crew untuk item pengambilan ini (seharusnya 1). Perlu ditelusuri manual sebelum bisa diedit lewat sini.`,
      });
    }
    const ledgerId = ledgerRes.rows[0].id;

    // Update qty_asli hanya kalau belum pernah dikoreksi sebelumnya
    const qtyAsliValue = item.qty_asli !== null ? item.qty_asli : item.qty;

    await client.query(`
      UPDATE sesi_pengambilan_item
      SET qty = $1, qty_asli = $2, dikoreksi_oleh = $3, dikoreksi_at = NOW()
      WHERE id = $4
    `, [qtyBaruNum, qtyAsliValue, req.user?.nama || req.user?.id || 'unknown', sesi_pengambilan_item_id]);

    await client.query(`
      UPDATE stok_ledger SET qty_delta = $1 WHERE id = $2
    `, [-qtyBaruNum, ledgerId]);

    // Ambil data untuk aktivitas (dalam transaksi, sebelum commit)
    const { rows: sesiRows } = await client.query(
      'SELECT id, gudang_asal_id, nama_crew FROM sesi_pengambilan_crew WHERE id = (SELECT sesi_id FROM sesi_pengambilan_item WHERE id = $1)',
      [sesi_pengambilan_item_id]
    );
    const { rows: itemNamaRows } = await client.query(
      'SELECT nama FROM item WHERE id = $1', [item.item_id]
    );

    await client.query('COMMIT');

    // Catat aktivitas (fire-and-forget, tidak gagalkan response)
    if (sesiRows.length) {
      onItemDikoreksiCepat(pool, {
        sesiId: sesiRows[0].id,
        actorUserId: req.user?.id,
        actorNama: req.user?.nama,
        actorRole: req.user?.role,
        itemNama: itemNamaRows[0]?.nama ?? 'item',
        qtyLama: item.qty,
        qtyBaru: qtyBaruNum,
        crewGudangId: sesiRows[0].gudang_asal_id,
        crewNama: sesiRows[0].nama_crew,
      }).catch((e) => console.error('[aktivitas] koreksi cepat:', e.message));
    }

    res.status(200).json({ sukses: true, pesan: 'Berhasil dikoreksi', qty_baru: qtyBaruNum });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * GET /api/laporan/riwayat-penyesuaian?gudang_id=&dari_tanggal=&sampai_tanggal=
 * Audit log semua penyesuaian stok sistem yang pernah dipicu lewat opname
 * (sesuaikanStok=true). Admin/owner saja — bukan buat device Admin Gudang.
 */
router.get('/riwayat-penyesuaian', requireAdmin, async (req, res, next) => {
  try {
    const { gudang_id, dari_tanggal, sampai_tanggal } = req.query;

    const { rows } = await pool.query(
      `SELECT
         sl.id AS ledger_id,
         sl.tanggal,
         sl.qty_delta,
         g.id AS gudang_id,
         g.nama AS nama_gudang,
         i.nama AS nama_item,
         i.kode_barang,
         i.satuan,
         so.stok_sistem_atau_diterima AS stok_sistem_sebelum,
         so.stok_fisik,
         so.selisih,
         so.jenis_opname,
         so.periode,
         u.nama AS dicatat_oleh
       FROM stok_ledger sl
       JOIN stok_opname so ON so.id = sl.referensi_id AND sl.referensi_tabel = 'stok_opname'
       JOIN item i ON i.id = sl.item_id
       JOIN gudang g ON g.id = sl.gudang_id
       JOIN users u ON u.id = so.dicatat_oleh_user_id
       WHERE sl.tipe_pergerakan = 'opname_penyesuaian'
         AND ($1::int IS NULL OR sl.gudang_id = $1)
         AND ($2::date IS NULL OR sl.tanggal >= $2)
         AND ($3::date IS NULL OR sl.tanggal <= $3)
       ORDER BY sl.tanggal DESC, sl.id DESC`,
      [gudang_id || null, dari_tanggal || null, sampai_tanggal || null]
    );

    res.status(200).json({ sukses: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/laporan/log-aktivitas?jenis=&dari_tanggal=&sampai_tanggal=&limit=&offset=
 * Timeline gabungan barang masuk (nota), stok opname, dan pengambilan crew,
 * lewat UNION ALL. Baris stok opname yang dikirim dalam 1 batch (submit form
 * yang sama) digabung jadi 1 baris timeline lewat GROUP BY per menit; tiap
 * baris bawa daftar item lengkap (json_agg) biar UI expand gak perlu fetch lagi.
 */
router.get('/log-aktivitas', requireAdmin, async (req, res, next) => {
  try {
    const { jenis, dari_tanggal, sampai_tanggal, limit, offset } = req.query;

    const jenisList = jenis ? jenis.split(',').map((j) => j.trim()) : null;
    const batasLimit = Math.min(Number(limit) || 50, 200);
    const mulaiOffset = Number(offset) || 0;

    const { rows } = await pool.query(
      `WITH gabungan AS (
         SELECT
           'barang_masuk' AS jenis,
           n.id AS ref_id,
           n.created_at,
           n.tanggal,
           n.status_verifikasi::text AS status,
           n.label_status,
           n.sumber AS info_teks,
           n.diinput_oleh_role::text AS peran,
           COALESCE(u.nama, n.nama_crew_input) AS pelaku,
           g.nama AS lokasi,
           (SELECT COUNT(*) FROM transaksi_masuk_item ti WHERE ti.nota_id = n.id) AS jumlah_item,
           NULL::numeric AS info_angka,
           (SELECT json_agg(json_build_object('nama', it.nama, 'jumlah', ti.jumlah, 'satuan', ti.satuan) ORDER BY it.nama)
            FROM transaksi_masuk_item ti JOIN item it ON it.id = ti.item_id WHERE ti.nota_id = n.id) AS detail_item
         FROM transaksi_masuk_nota n
         LEFT JOIN users u ON u.id = n.diinput_oleh_user_id
         LEFT JOIN gudang g ON g.id = n.gudang_id

         UNION ALL

         SELECT
           'stok_opname' AS jenis,
           MIN(so.id) AS ref_id,
           date_trunc('minute', so.created_at) AS created_at,
           so.tanggal,
           so.jenis_opname AS status,
           NULL AS label_status,
           NULL AS info_teks,
           NULL AS peran,
           u.nama AS pelaku,
           COALESCE(g.nama, o.nama) AS lokasi,
           COUNT(*) AS jumlah_item,
           SUM(ABS(so.selisih)) AS info_angka,
           json_agg(json_build_object('nama', i.nama, 'selisih', so.selisih) ORDER BY i.nama) AS detail_item
         FROM stok_opname so
         JOIN users u ON u.id = so.dicatat_oleh_user_id
         JOIN item i ON i.id = so.item_id
         LEFT JOIN gudang g ON g.id = so.gudang_id
         LEFT JOIN outlet o ON o.id = so.outlet_id
         GROUP BY date_trunc('minute', so.created_at), so.tanggal, so.jenis_opname, u.nama, g.nama, o.nama

         UNION ALL

         SELECT
           'pengambilan_crew' AS jenis,
           s.id AS ref_id,
           s.created_at,
           s.tanggal,
           COALESCE(s.label_status, 'normal') AS status,
           s.label_status,
           NULL AS info_teks,
           NULL AS peran,
           s.nama_crew AS pelaku,
           COALESCE(ga.nama, ot.nama) AS lokasi,
           (SELECT COUNT(*) FROM sesi_pengambilan_item si WHERE si.sesi_id = s.id) AS jumlah_item,
           NULL::numeric AS info_angka,
           (SELECT json_agg(json_build_object(
              'nama', it.nama,
              'jumlah', si.qty,
              'qty_asli', si.qty_asli,
              'dikoreksi_oleh', si.dikoreksi_oleh,
              'dikoreksi_at', si.dikoreksi_at
            ) ORDER BY it.nama)
            FROM sesi_pengambilan_item si JOIN item it ON it.id = si.item_id WHERE si.sesi_id = s.id) AS detail_item
         FROM sesi_pengambilan_crew s
         LEFT JOIN gudang ga ON ga.id = s.gudang_asal_id
         LEFT JOIN outlet ot ON ot.id = s.outlet_tujuan_id
       )
       SELECT * FROM gabungan
       WHERE ($1::text[] IS NULL OR jenis = ANY($1))
         AND tanggal >= COALESCE($2::date, CURRENT_DATE - INTERVAL '7 days')
         AND ($3::date IS NULL OR tanggal <= $3)
       ORDER BY created_at DESC
       LIMIT $4 OFFSET $5`,
      [jenisList, dari_tanggal || null, sampai_tanggal || null, batasLimit, mulaiOffset]
    );

    res.status(200).json({ sukses: true, data: rows, hasLebih: rows.length === batasLimit });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
