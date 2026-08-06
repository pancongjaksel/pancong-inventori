const { pool } = require('../db/pool');
const {
  validasiFieldDasar,
  validasiBelumAdaOpname,
  validasiAksesGudangAdmin,
  hitungStokSistemGudang,
  hitungTotalDiterimaOutlet,
  ambilStokAwalPeriode,
} = require('../validators/stokOpnameValidator');

/**
 * Opname Gudang (5.6.A) — TIDAK kumulatif. Dibandingkan ke stok sistem
 * (snapshot v_stok_gudang_saat_ini) saat opname dibuat, stok_awal_periode
 * selalu 0 untuk tipe gudang.
 *
 * @param {boolean} [input.sesuaikanStok] - kalau true, DAN ada selisih,
 *   tulis 1 baris stok_ledger tipe 'opname_penyesuaian' supaya stok sistem
 *   sinkron ke hasil hitung fisik (opsional — PRD gak wajibkan auto-adjust,
 *   tapi ini best practice standar biar bulan depan opname mulai dari angka
 *   yang benar, bukan numpuk selisih terus-terusan).
 */
async function buatOpnameGudang(input) {
  const { gudangId, itemId, stokFisik, periode, userId, sesuaikanStok = false } = input;

  validasiFieldDasar({ itemId, stokFisik, periode });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await validasiAksesGudangAdmin(client, { userId, gudangId });
    await validasiBelumAdaOpname(client, { lokasiTipe: 'gudang', gudangId, outletId: null, itemId, periode });

    const stokSistem = await hitungStokSistemGudang(client, { gudangId, itemId });

    const { rows } = await client.query(
      `INSERT INTO stok_opname
         (lokasi_tipe, gudang_id, item_id, periode, stok_awal_periode, stok_sistem_atau_diterima, stok_fisik, dicatat_oleh_user_id)
       VALUES ('gudang', $1, $2, $3, 0, $4, $5, $6)
       RETURNING id, selisih`,
      [gudangId, itemId, periode, stokSistem, stokFisik, userId]
    );
    const { id: opnameId, selisih } = rows[0];

    let ledgerPenyesuaianId = null;
    if (sesuaikanStok && Number(selisih) !== 0) {
      // selisih = stok_sistem - stok_fisik (kolom generated di DB).
      // Supaya sistem sinkron ke fisik: qty_delta = stok_fisik - stok_sistem = -selisih
      const { rows: ledgerRows } = await client.query(
        `INSERT INTO stok_ledger (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
         VALUES ($1, $2, 'opname_penyesuaian', $3, 'stok_opname', $4, now())
         RETURNING id`,
        [itemId, gudangId, -Number(selisih), opnameId]
      );
      ledgerPenyesuaianId = ledgerRows[0].id;
    }

    await client.query('COMMIT');
    return { opnameId, stokSistem, stokFisik, selisih: Number(selisih), disesuaikan: ledgerPenyesuaianId !== null };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Opname Outlet (5.6.B) — KUMULATIF (keputusan Q2). stok_awal_periode
 * diambil dari stok_fisik hasil opname bulan sebelumnya (carry-over).
 * Kalau outlet ini belum pernah di-opname bulan lalu, stok_awal fallback 0
 * dan caller diberi tahu lewat `baselineDipakai: false` (idealnya UI kasih
 * peringatan ke admin: "belum ada data bulan lalu, pastikan ini opname
 * pertama / isi manual kalau ada stok sisa yang diketahui").
 */
async function buatOpnameOutlet(input) {
  const { outletId, itemId, stokFisik, periode, userId, stokAwalManual } = input;

  validasiFieldDasar({ itemId, stokFisik, periode });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Opname outlet dianggap tugas Admin juga (konsisten dengan modul lain),
    // tapi tidak terikat ke satu gudang tertentu — jadi cukup cek role aktif,
    // tanpa cek user_akses_gudang (outlet bisa dilayani gudang mana pun).
    // Reuse validasiAksesGudangAdmin dengan gudangId dari outlet.gudang_asal_id
    // supaya konsisten: admin yang boleh opname outlet = admin yang boleh
    // akses gudang yang melayani outlet itu.
    const { rows: outletRows } = await client.query('SELECT gudang_asal_id, nama FROM outlet WHERE id = $1', [outletId]);
    if (!outletRows[0]) {
      const { AppError } = require('../errors/AppError');
      throw new AppError(`Outlet tidak ditemukan (id=${outletId}).`, 404, 'OUTLET_TIDAK_DITEMUKAN');
    }
    await validasiAksesGudangAdmin(client, { userId, gudangId: outletRows[0].gudang_asal_id });

    await validasiBelumAdaOpname(client, { lokasiTipe: 'outlet', gudangId: null, outletId, itemId, periode });

    const totalDiterima = await hitungTotalDiterimaOutlet(client, { outletId, itemId, periode });

    let stokAwal;
    let baselineDipakai;
    if (stokAwalManual !== undefined && stokAwalManual !== null) {
      // Admin override manual (dipakai untuk opname bulan pertama / go-live)
      stokAwal = Number(stokAwalManual);
      baselineDipakai = true;
    } else {
      const hasil = await ambilStokAwalPeriode(client, { outletId, itemId, periode });
      stokAwal = hasil.stokAwal;
      baselineDipakai = hasil.baseline;
    }

    const { rows } = await client.query(
      `INSERT INTO stok_opname
         (lokasi_tipe, outlet_id, item_id, periode, stok_awal_periode, stok_sistem_atau_diterima, stok_fisik, dicatat_oleh_user_id)
       VALUES ('outlet', $1, $2, $3, $4, $5, $6, $7)
       RETURNING id, selisih`,
      [outletId, itemId, periode, stokAwal, totalDiterima, stokFisik, userId]
    );

    await client.query('COMMIT');
    return {
      opnameId: rows[0].id,
      stokAwalPeriode: stokAwal,
      baselineDipakai, // false = fallback ke 0, gak ada data opname bulan lalu
      totalDiterima,
      stokFisik,
      selisih: Number(rows[0].selisih),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { buatOpnameGudang, buatOpnameOutlet };
