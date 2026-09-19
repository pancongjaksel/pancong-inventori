const { pool } = require('../db/pool');

const TIPE = {
  PENGAMBILAN_DIBUAT: 'PENGAMBILAN_DIBUAT',
  PENGAMBILAN_DIKOREKSI: 'PENGAMBILAN_DIKOREKSI',
  ITEM_DIKOREKSI_CEPAT: 'ITEM_DIKOREKSI_CEPAT',
  CATATAN_DITAMBAHKAN: 'CATATAN_DITAMBAHKAN',
};

/**
 * Catat satu baris aktivitas. Dipanggil dalam transaksi DB yang sama
 * dengan business action-nya (client di-passing dari luar), atau
 * standalone kalau business action sudah commit.
 *
 * @param {object} client - pg client (dalam transaksi) atau pool (standalone)
 * @param {object} params
 * @param {number} params.sesiId
 * @param {string} params.tipe - salah satu dari TIPE konstanta di atas
 * @param {'crew'|'admin'|'owner'|'system'} params.actorTipe
 * @param {number} [params.actorUserId]   - untuk admin/owner
 * @param {number} [params.actorGudangId] - untuk crew
 * @param {string} [params.actorNama]     - nama saat kejadian
 * @param {string} params.judul
 * @param {string} [params.deskripsi]
 * @param {object} [params.metadata]
 */
async function catatAktivitas(client, {
  sesiId, tipe, actorTipe, actorUserId, actorGudangId, actorNama,
  judul, deskripsi, metadata,
}) {
  await client.query(
    `INSERT INTO aktivitas_pengambilan
       (sesi_pengambilan_id, tipe, actor_tipe, actor_user_id, actor_gudang_id,
        actor_nama, judul, deskripsi, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      sesiId, tipe, actorTipe,
      actorUserId ?? null, actorGudangId ?? null, actorNama ?? null,
      judul, deskripsi ?? null,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
}

/**
 * Buat notifikasi untuk satu user (admin/owner) atau satu crew (gudang+nama).
 * Juga berjalan dalam transaksi yang sama bila client di-passing.
 */
async function buatNotifikasi(client, {
  userId, crewGudangId, crewNama,
  tipe, judul, pesan,
  referenceTipe, referenceId,
}) {
  await client.query(
    `INSERT INTO notifikasi
       (user_id, crew_gudang_id, crew_nama, tipe, judul, pesan, reference_tipe, reference_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      userId ?? null, crewGudangId ?? null, crewNama ?? null,
      tipe, judul, pesan ?? null,
      referenceTipe ?? null, referenceId ?? null,
    ],
  );
}

/**
 * Setelah pengambilan dibuat, catat aktivitas + kirim notifikasi ke semua admin/owner.
 * Dipanggil dalam transaksi yang sama dengan insert sesi.
 */
async function onPengambilanDibuat(client, { sesiId, actorGudangId, actorNama, namaOutlet }) {
  await catatAktivitas(client, {
    sesiId,
    tipe: TIPE.PENGAMBILAN_DIBUAT,
    actorTipe: 'crew',
    actorGudangId,
    actorNama,
    judul: 'Pengambilan dibuat',
    deskripsi: `${actorNama} membuat pengambilan untuk ${namaOutlet}`,
  });

  // Notifikasi ke semua admin & owner
  const { rows: admins } = await client.query(
    `SELECT id FROM users WHERE role IN ('admin','owner') AND aktif = true`,
  );
  for (const admin of admins) {
    await buatNotifikasi(client, {
      userId: admin.id,
      tipe: 'PENGAMBILAN_BARU',
      judul: 'Pengambilan baru',
      pesan: `${actorNama} mengambil barang untuk ${namaOutlet}`,
      referenceTipe: 'sesi_pengambilan',
      referenceId: sesiId,
    });
  }
}

/**
 * Setelah koreksi penuh (koreksiTransaksi service), catat aktivitas.
 * Dipanggil standalone (setelah COMMIT koreksi).
 */
async function onPengambilanDikoreksi(pool_, {
  sesiId, actorUserId, actorNama, actorRole, alasan, crewGudangId, crewNama,
}) {
  const client = await pool_.connect();
  try {
    await client.query('BEGIN');

    await catatAktivitas(client, {
      sesiId,
      tipe: TIPE.PENGAMBILAN_DIKOREKSI,
      actorTipe: actorRole === 'owner' ? 'owner' : 'admin',
      actorUserId,
      actorNama,
      judul: 'Pengambilan dikoreksi',
      deskripsi: alasan,
    });

    // Notifikasi ke crew
    if (crewGudangId && crewNama) {
      await buatNotifikasi(client, {
        crewGudangId,
        crewNama,
        tipe: 'PENGAMBILAN_DIKOREKSI',
        judul: 'Pengambilan dikoreksi',
        pesan: `Admin mengoreksi pengambilanmu. Alasan: ${alasan}`,
        referenceTipe: 'sesi_pengambilan',
        referenceId: sesiId,
      });
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    // Gagal catat aktivitas tidak boleh melempar error ke business flow
    console.error('[aktivitas] Gagal catat koreksi:', err.message);
  } finally {
    client.release();
  }
}

/**
 * Setelah koreksi cepat item, catat aktivitas.
 */
async function onItemDikoreksiCepat(pool_, {
  sesiId, actorUserId, actorNama, actorRole, itemNama, qtyLama, qtyBaru,
  crewGudangId, crewNama,
}) {
  const client = await pool_.connect();
  try {
    await client.query('BEGIN');

    await catatAktivitas(client, {
      sesiId,
      tipe: TIPE.ITEM_DIKOREKSI_CEPAT,
      actorTipe: actorRole === 'owner' ? 'owner' : 'admin',
      actorUserId,
      actorNama,
      judul: 'Item dikoreksi',
      deskripsi: `${itemNama}: ${qtyLama} → ${qtyBaru}`,
      metadata: { item_nama: itemNama, qty_lama: qtyLama, qty_baru: qtyBaru },
    });

    if (crewGudangId && crewNama) {
      await buatNotifikasi(client, {
        crewGudangId,
        crewNama,
        tipe: 'PENGAMBILAN_DIKOREKSI',
        judul: 'Item dikoreksi',
        pesan: `Admin mengoreksi ${itemNama} dari ${qtyLama} menjadi ${qtyBaru}`,
        referenceTipe: 'sesi_pengambilan',
        referenceId: sesiId,
      });
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[aktivitas] Gagal catat koreksi cepat:', err.message);
  } finally {
    client.release();
  }
}

/**
 * Setelah catatan ditambahkan.
 */
async function onCatatanDitambahkan(pool_, {
  sesiId, actorUserId, actorNama, actorRole, catatan, crewGudangId, crewNama,
}) {
  const client = await pool_.connect();
  try {
    await client.query('BEGIN');

    await catatAktivitas(client, {
      sesiId,
      tipe: TIPE.CATATAN_DITAMBAHKAN,
      actorTipe: actorRole === 'owner' ? 'owner' : 'admin',
      actorUserId,
      actorNama,
      judul: 'Admin menambahkan catatan',
      deskripsi: catatan,
    });

    if (crewGudangId && crewNama) {
      await buatNotifikasi(client, {
        crewGudangId,
        crewNama,
        tipe: 'CATATAN_BARU',
        judul: 'Ada catatan baru',
        pesan: `Admin menambahkan catatan: "${catatan.slice(0, 80)}${catatan.length > 80 ? '…' : ''}"`,
        referenceTipe: 'sesi_pengambilan',
        referenceId: sesiId,
      });
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[aktivitas] Gagal catat catatan:', err.message);
  } finally {
    client.release();
  }
}

module.exports = {
  TIPE,
  catatAktivitas,
  buatNotifikasi,
  onPengambilanDibuat,
  onPengambilanDikoreksi,
  onItemDikoreksiCepat,
  onCatatanDitambahkan,
};
