const express = require('express');
const { pool } = require('../db/pool');
const { requireAdmin, requireAdminOrGudang } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/dashboard
 * Operational command center — summary hari ini, needs attention,
 * activity feed (pengambilan + transfer + barang masuk + koreksi),
 * dan quick insights. Semua data terbatas ke hari ini atau ringkasan
 * kecil — tidak pernah fetch seluruh inventory.
 */
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    // 1. Summary hari ini — 4 counter dalam 1 query
    const { rows: summaryRows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM sesi_pengambilan_crew WHERE tanggal = CURRENT_DATE) AS pengambilan,
        (SELECT COUNT(*)::int FROM transfer_gudang WHERE DATE(tanggal_kirim) = CURRENT_DATE) AS transfer,
        (SELECT COUNT(*)::int FROM transaksi_masuk_nota WHERE tanggal = CURRENT_DATE) AS barang_masuk,
        (SELECT COUNT(*)::int FROM koreksi_transaksi WHERE DATE(tanggal) = CURRENT_DATE) AS koreksi
    `);
    const summary = summaryRows[0];

    // 2. Needs attention (paralel)
    const [stokKritisRes, opnamePendingRes, notaMenungguRes, transferPendingRes] = await Promise.all([
      pool.query(`
        SELECT vm.item_id, vm.gudang_id, vm.nama_item, vm.nama_gudang,
               vm.stok_saat_ini, vm.satuan, vm.reorder_point
        FROM v_stok_menipis vm
        JOIN item i ON i.id = vm.item_id
        WHERE i.status_aktif = true
          AND (
            i.kategori != 'Bahan Adonan'
            OR i.selalu_tampil_semua_gudang = true
            OR i.gudang_default_id = vm.gudang_id
          )
          AND NOT (i.kategori = 'Topping' AND vm.nama_gudang ILIKE '%produksi%')
        ORDER BY vm.stok_saat_ini ASC, vm.nama_gudang, vm.nama_item
        LIMIT 10
      `),
      pool.query(`SELECT COUNT(*)::int AS jumlah FROM opname_outlet WHERE status = 'menunggu_approval'`),
      pool.query(`SELECT COUNT(*)::int AS jumlah FROM transaksi_masuk_nota WHERE status_verifikasi = 'menunggu'`),
      pool.query(`SELECT COUNT(*)::int AS jumlah FROM transfer_gudang WHERE status = 'dikirim'`),
    ]);

    // 3. Activity feed hari ini — UNION ALL 4 sumber
    const { rows: activities } = await pool.query(`
      WITH gabungan AS (
        SELECT
          'pengambilan' AS jenis,
          sp.id AS ref_id,
          sp.created_at,
          sp.nama_crew AS pelaku,
          ga.nama AS lokasi,
          o.nama AS lokasi_tujuan,
          (SELECT COUNT(*)::int FROM sesi_pengambilan_item si WHERE si.sesi_id = sp.id) AS jumlah_item,
          sp.label_status,
          NULL::text AS deskripsi_extra
        FROM sesi_pengambilan_crew sp
        JOIN gudang ga ON ga.id = sp.gudang_asal_id
        JOIN outlet o ON o.id = sp.outlet_tujuan_id
        WHERE sp.tanggal = CURRENT_DATE

        UNION ALL

        SELECT
          'transfer' AS jenis,
          tg.id AS ref_id,
          tg.tanggal_kirim AS created_at,
          u.nama AS pelaku,
          ga.nama AS lokasi,
          gt.nama AS lokasi_tujuan,
          1 AS jumlah_item,
          tg.label_status,
          i.nama || ' — ' || tg.jumlah::text || ' ' || i.satuan AS deskripsi_extra
        FROM transfer_gudang tg
        JOIN users u ON u.id = tg.dikirim_oleh_user_id
        JOIN gudang ga ON ga.id = tg.gudang_asal_id
        JOIN gudang gt ON gt.id = tg.gudang_tujuan_id
        JOIN item i ON i.id = tg.item_id
        WHERE DATE(tg.tanggal_kirim) = CURRENT_DATE

        UNION ALL

        SELECT
          'barang_masuk' AS jenis,
          n.id AS ref_id,
          n.created_at,
          COALESCE(u.nama, n.nama_crew_input, 'Crew') AS pelaku,
          g.nama AS lokasi,
          NULL AS lokasi_tujuan,
          (SELECT COUNT(*)::int FROM transaksi_masuk_item ti WHERE ti.nota_id = n.id) AS jumlah_item,
          n.label_status,
          n.sumber AS deskripsi_extra
        FROM transaksi_masuk_nota n
        LEFT JOIN users u ON u.id = n.diinput_oleh_user_id
        LEFT JOIN gudang g ON g.id = n.gudang_id
        WHERE n.tanggal = CURRENT_DATE

        UNION ALL

        SELECT
          'koreksi' AS jenis,
          kt.id AS ref_id,
          kt.tanggal AS created_at,
          u.nama AS pelaku,
          kt.tabel_transaksi AS lokasi,
          NULL AS lokasi_tujuan,
          1 AS jumlah_item,
          NULL AS label_status,
          kt.alasan AS deskripsi_extra
        FROM koreksi_transaksi kt
        JOIN users u ON u.id = kt.oleh_user_id
        WHERE DATE(kt.tanggal) = CURRENT_DATE
      )
      SELECT * FROM gabungan ORDER BY created_at DESC LIMIT 50
    `);

    // 4. Quick insights: item terlaris + perubahan pengambilan vs 7 hari lalu
    const [itemTerlarisRes, perubahRes] = await Promise.all([
      pool.query(`
        SELECT i.nama, i.satuan, SUM(spi.qty)::numeric AS total_qty,
               COUNT(DISTINCT sp.outlet_tujuan_id)::int AS jumlah_outlet
        FROM sesi_pengambilan_crew sp
        JOIN sesi_pengambilan_item spi ON spi.sesi_id = sp.id
        JOIN item i ON i.id = spi.item_id
        WHERE sp.tanggal = CURRENT_DATE
          AND COALESCE(sp.label_status, '') != 'Dikoreksi'
        GROUP BY i.id, i.nama
        ORDER BY total_qty DESC
        LIMIT 1
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM sesi_pengambilan_crew WHERE tanggal = CURRENT_DATE) AS hari_ini,
          ROUND(AVG(cnt), 2) AS rata_7_hari
        FROM (
          SELECT tanggal, COUNT(*) AS cnt
          FROM sesi_pengambilan_crew
          WHERE tanggal >= CURRENT_DATE - INTERVAL '8 days'
            AND tanggal < CURRENT_DATE
          GROUP BY tanggal
        ) t
      `),
    ]);

    const rata7 = Number(perubahRes.rows[0]?.rata_7_hari);
    const hariIni = Number(perubahRes.rows[0]?.hari_ini ?? summary.pengambilan);
    const pctPerubahan = rata7 > 0
      ? Math.round(((hariIni - rata7) / rata7) * 100)
      : null;

    res.status(200).json({
      sukses: true,
      data: {
        summary,
        attention: {
          stok_kritis: stokKritisRes.rows,
          opname_pending: opnamePendingRes.rows[0].jumlah,
          nota_menunggu: notaMenungguRes.rows[0].jumlah,
          transfer_pending: transferPendingRes.rows[0].jumlah,
        },
        activities,
        insights: {
          item_terlaris: itemTerlarisRes.rows[0] || null,
          pct_perubahan: pctPerubahan,
          pengambilan_hari_ini: hariIni,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/approval-center', requireAdminOrGudang, async (req, res, next) => {
  if (req.user.role !== 'owner' && req.user.role !== 'admin_gudang') return res.status(403).json({ sukses:false, kode:'AKSES_DITOLAK', pesan:'Approval Center hanya untuk Owner atau Admin Gudang.' });
  try {
    const adminGudang = req.user.role === 'admin_gudang';
    const crew = adminGudang ? await pool.query(`SELECT n.id, 'barang_masuk' AS jenis, g.nama AS lokasi, COALESCE(n.nama_crew_input,'Crew') AS dibuat_oleh, n.created_at, ROUND(EXTRACT(EPOCH FROM (now()-n.created_at))/60)::int AS umur_menit, (SELECT string_agg(i.nama || ' x ' || ti.jumlah::text, ', ' ORDER BY i.nama) FROM transaksi_masuk_item ti JOIN item i ON i.id=ti.item_id WHERE ti.nota_id=n.id) AS ringkasan FROM transaksi_masuk_nota n JOIN gudang g ON g.id=n.gudang_id WHERE n.status_verifikasi='menunggu' AND n.diinput_oleh_role='crew' AND g.tipe='serving' ORDER BY n.created_at LIMIT 50`) : { rows: [] };
    const transfer = !adminGudang ? await pool.query(`SELECT tg.id, 'transfer' AS jenis, ga.nama AS lokasi, gt.nama AS lokasi_tujuan, u.nama AS dibuat_oleh, tg.tanggal_kirim AS created_at, ROUND(EXTRACT(EPOCH FROM (now()-tg.tanggal_kirim))/60)::int AS umur_menit, i.nama || ' x ' || tg.jumlah::text || ' ' || i.satuan AS ringkasan FROM transfer_gudang tg JOIN gudang ga ON ga.id=tg.gudang_asal_id JOIN gudang gt ON gt.id=tg.gudang_tujuan_id JOIN users u ON u.id=tg.dikirim_oleh_user_id JOIN item i ON i.id=tg.item_id WHERE tg.status='menunggu_approval' AND tg.sumber_transaksi='admin_gudang' AND tg.status_verifikasi='menunggu' ORDER BY tg.tanggal_kirim LIMIT 50`) : { rows: [] };
    res.json({ sukses:true, data:{ pending_crew_barang_masuk:crew.rows.length, pending_transfer_owner:transfer.rows.length, barang_masuk_crew:crew.rows, transfer_admin_gudang:transfer.rows } });
  } catch (err) { next(err); }
});

module.exports = router;
