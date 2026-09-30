const { pool } = require('../db/pool');
const {
  validasiFieldDasar,
  validasiTanggal,
  validasiFasePeriode,
  validasiBelumAdaOpname,
  validasiAksesGudangAdmin,
  hitungStokSistemGudang,
  hitungTotalDiterimaOutlet,
  ambilStokAwalPeriode,
} = require('../validators/stokOpnameValidator');

async function buatOpnameGudang(input) {
  const { gudangId, itemId, stokFisik, periode, userId, jenisOpname, faseOpname, tanggal, sesiId } = input;

  validasiFieldDasar({ itemId, stokFisik, periode, jenisOpname });
  validasiTanggal(tanggal, periode);

  const jenis = jenisOpname || 'bulanan';
  const fasePeriode = validasiFasePeriode({ fasePeriode: faseOpname, jenisOpname: jenis, tanggal, periode });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await validasiAksesGudangAdmin(client, { userId, gudangId });

    await validasiBelumAdaOpname(client, {
      lokasiTipe: 'gudang',
      gudangId,
      outletId: null,
      itemId,
      periode,
      jenisOpname: jenis,
      tanggal,
    });

    const stokSistem = await hitungStokSistemGudang(client, { gudangId, itemId });

    const { rows } = await client.query(
      `INSERT INTO stok_opname
         (lokasi_tipe, gudang_id, item_id, periode, stok_awal_periode,
          stok_sistem_atau_diterima, stok_fisik, dicatat_oleh_user_id,
          jenis_opname, fase_periode, tanggal, sesi_id, status)
       VALUES ('gudang', $1, $2, $3, 0, $4, $5, $6, $7, $8, $9, $10, 'menunggu')
       RETURNING id, selisih`,
      [gudangId, itemId, periode, stokSistem, stokFisik, userId, jenis, fasePeriode, tanggal, sesiId || null]
    );
    const { id: opnameId, selisih } = rows[0];

    await client.query('COMMIT');
    return {
      opnameId,
      stokSistem,
      stokFisik,
      selisih: Number(selisih),
      jenisOpname: jenis,
      fasePeriode,
      tanggal,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function buatOpnameOutlet(input) {
  const { outletId, itemId, stokFisik, periode, userId, stokAwalManual, tanggal, tipeOpname } = input;
  const tipe = tipeOpname === 'awal' ? 'awal' : 'akhir';

  validasiFieldDasar({ itemId, stokFisik, periode });
  validasiTanggal(tanggal, periode);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: outletRows } = await client.query('SELECT gudang_asal_id, nama FROM outlet WHERE id = $1', [outletId]);
    if (!outletRows[0]) {
      const { AppError } = require('../errors/AppError');
      throw new AppError(`Outlet tidak ditemukan (id=${outletId}).`, 404, 'OUTLET_TIDAK_DITEMUKAN');
    }
    await validasiAksesGudangAdmin(client, { userId, gudangId: outletRows[0].gudang_asal_id });

    await validasiBelumAdaOpname(client, { lokasiTipe: 'outlet', gudangId: null, outletId, itemId, periode, tanggal, tipeOpname: tipe });

    const totalDiterima = await hitungTotalDiterimaOutlet(client, { outletId, itemId, periode });

    let stokAwal;
    let baselineDipakai;
    if (stokAwalManual !== undefined && stokAwalManual !== null) {
      stokAwal = Number(stokAwalManual);
      baselineDipakai = true;
    } else {
      const hasil = await ambilStokAwalPeriode(client, { outletId, itemId, periode });
      stokAwal = hasil.stokAwal;
      baselineDipakai = hasil.baseline;
    }

    const { rows } = await client.query(
      `INSERT INTO stok_opname
         (lokasi_tipe, outlet_id, item_id, periode, stok_awal_periode, stok_sistem_atau_diterima, stok_fisik, dicatat_oleh_user_id, tanggal, tipe_opname)
       VALUES ('outlet', $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, selisih`,
      [outletId, itemId, periode, stokAwal, totalDiterima, stokFisik, userId, tanggal, tipe]
    );

    await client.query('COMMIT');
    return {
      opnameId: rows[0].id,
      stokAwalPeriode: stokAwal,
      baselineDipakai,
      totalDiterima,
      stokFisik,
      selisih: Number(rows[0].selisih),
      tanggal,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function buatOpnameOutletCrew(input) {
  const { outletId, itemId, stokFisik, periode, deviceId, stokAwalManual, tanggal, tipeOpname } = input;
  const tipe = tipeOpname === 'awal' ? 'awal' : 'akhir';

  validasiFieldDasar({ itemId, stokFisik, periode });
  validasiTanggal(tanggal, periode);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: outletRows } = await client.query('SELECT gudang_asal_id, nama FROM outlet WHERE id = $1', [outletId]);
    if (!outletRows[0]) {
      const { AppError } = require('../errors/AppError');
      throw new AppError(`Outlet tidak ditemukan (id=${outletId}).`, 404, 'OUTLET_TIDAK_DITEMUKAN');
    }

    await validasiBelumAdaOpname(client, { lokasiTipe: 'outlet', gudangId: null, outletId, itemId, periode, tanggal, tipeOpname: tipe });

    const totalDiterima = await hitungTotalDiterimaOutlet(client, { outletId, itemId, periode });

    let stokAwal;
    let baselineDipakai;
    if (stokAwalManual !== undefined && stokAwalManual !== null) {
      stokAwal = Number(stokAwalManual);
      baselineDipakai = true;
    } else {
      const hasil = await ambilStokAwalPeriode(client, { outletId, itemId, periode });
      stokAwal = hasil.stokAwal;
      baselineDipakai = hasil.baseline;
    }

    const { rows } = await client.query(
      `INSERT INTO stok_opname
         (lokasi_tipe, outlet_id, item_id, periode, stok_awal_periode, stok_sistem_atau_diterima, stok_fisik,
          dicatat_oleh_user_id, dicatat_oleh_device_id, tanggal, tipe_opname)
       VALUES ('outlet', $1, $2, $3, $4, $5, $6, NULL, $7, $8, $9)
       RETURNING id, selisih`,
      [outletId, itemId, periode, stokAwal, totalDiterima, stokFisik, deviceId ?? null, tanggal, tipe]
    );

    await client.query('COMMIT');
    return {
      opnameId: rows[0].id,
      stokAwalPeriode: stokAwal,
      baselineDipakai,
      totalDiterima,
      stokFisik,
      selisih: Number(rows[0].selisih),
      tanggal,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { buatOpnameGudang, buatOpnameOutlet, buatOpnameOutletCrew };
