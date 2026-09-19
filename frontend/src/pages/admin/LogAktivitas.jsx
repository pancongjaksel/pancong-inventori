import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../../api/client';

const JENIS_INFO = {
  barang_masuk: { label: 'Penerimaan', warna: '#16a34a', emoji: '🟢' },
  stok_opname: { label: 'Stok Opname', warna: '#2563eb', emoji: '🔵' },
  pengambilan_crew: { label: 'Pengambilan Crew', warna: '#ca8a04', emoji: '🟡' },
};

function waktuRelatif(iso) {
  const detik = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  if (detik < 172800) return 'kemarin';
  return `${Math.floor(detik / 86400)} hari lalu`;
}

function teksBaris(row) {
  const pelaku = row.pelaku || 'Seseorang';
  const lokasi = row.lokasi || '-';

  if (row.jenis === 'barang_masuk') {
    return `${pelaku} input nota barang masuk (${row.jumlah_item} item) — ${lokasi}`;
  }

  if (row.jenis === 'stok_opname') {
    if (row.detail_item && row.detail_item.length === 1) {
      const d = row.detail_item[0];
      const selisihTxt = d.selisih > 0 ? `+${d.selisih}` : d.selisih;
      return `${pelaku} catat stok opname ${d.nama} — ${lokasi} — selisih ${selisihTxt}`;
    }
    return `${pelaku} catat stok opname (${row.jumlah_item} item) — ${lokasi}`;
  }

  if (row.jenis === 'pengambilan_crew') {
    return `${pelaku} ambil barang (${row.jumlah_item} item) — dari ${lokasi}`;
  }

  return '-';
}

export default function LogAktivitas() {
  const [data, setData] = useState([]);
  const [jenisAktif, setJenisAktif] = useState(['barang_masuk', 'stok_opname', 'pengambilan_crew']);
  const [dariTanggal, setDariTanggal] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasLebih, setHasLebih] = useState(false);

  const muatData = useCallback(async (offsetBaru, tambahkan) => {
    if (jenisAktif.length === 0) {
      // Semua badge jenis di-nonaktifkan — tampilkan kosong lokal tanpa fetch.
      // Kalau tetap fetch, backend bakal terima jenis='' yang berarti "tanpa
      // filter" (tampilkan semua), kebalikan dari yang dimaksud toggle ini.
      setData([]);
      setHasLebih(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('jenis', jenisAktif.join(','));
      if (dariTanggal) params.set('dari_tanggal', dariTanggal);
      params.set('offset', offsetBaru);
      params.set('limit', 50);

      const hasil = await api.get(`/laporan/log-aktivitas?${params.toString()}`);
      setData((prev) => (tambahkan ? [...prev, ...(hasil || [])] : hasil || []));
      // api.get hanya unwrap `.data`; field `hasLebih` di respons asli ada di level sibling
      // dan tidak ikut terbawa. Pakai heuristik: kalau hasil penuh 50 baris, anggap masih ada lagi.
      setHasLebih((hasil || []).length === 50);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat log aktivitas.');
    } finally {
      setLoading(false);
    }
  }, [jenisAktif, dariTanggal]);

  useEffect(() => {
    setOffset(0);
    muatData(0, false);
  }, [jenisAktif, dariTanggal, muatData]);

  function toggleJenis(j) {
    setJenisAktif((prev) => (prev.includes(j) ? prev.filter((x) => x !== j) : [...prev, j]));
  }

  function muatLebih() {
    const offsetBaru = offset + 50;
    setOffset(offsetBaru);
    muatData(offsetBaru, true);
  }

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Log Aktivitas</h1>
      <p style={{ color: 'var(--warna-abu, #6b7280)', marginTop: 0, marginBottom: 20 }}>
        Timeline gabungan: barang masuk, stok opname, dan pengambilan crew.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(JENIS_INFO).map(([key, info]) => (
          <button
            key={key}
            onClick={() => toggleJenis(key)}
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              border: `1.5px solid ${info.warna}`,
              background: jenisAktif.includes(key) ? info.warna : 'transparent',
              color: jenisAktif.includes(key) ? 'white' : info.warna,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {info.emoji} {info.label}
          </button>
        ))}
        <input
          type="date"
          value={dariTanggal}
          onChange={(e) => setDariTanggal(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, marginLeft: 'auto' }}
        />
        <span style={{ fontSize: 12, color: 'var(--warna-abu, #6b7280)' }}>
          {dariTanggal ? '' : '(7 hari terakhir)'}
        </span>
      </div>

      {error && <p style={{ color: 'var(--warna-bahaya, #dc2626)' }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {data.map((row) => {
          const info = JENIS_INFO[row.jenis];
          const id = `${row.jenis}-${row.ref_id}`;
          const expanded = expandedId === id;
          const detailItemBanyak = row.detail_item && row.detail_item.length > (row.jenis === 'stok_opname' ? 1 : 0);
          return (
            <div
              key={id}
              className="kartu"
              style={{ padding: '12px 14px', cursor: 'pointer', borderLeft: `4px solid ${info?.warna || '#ccc'}` }}
              onClick={() => setExpandedId(expanded ? null : id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 14 }}>{teksBaris(row)}</span>
                <span style={{ fontSize: 12, color: 'var(--warna-abu, #6b7280)', whiteSpace: 'nowrap' }}>
                  {waktuRelatif(row.created_at)}
                </span>
              </div>
              {expanded && (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--warna-abu, #6b7280)', display: 'grid', gap: 6 }}>
                  <div>Tanggal: {row.tanggal}</div>
                  <div>Status: {row.status}{row.label_status ? ` (${row.label_status})` : ''}</div>
                  {row.info_teks && <div>Supplier: {row.info_teks}</div>}
                  {row.peran && <div>Diinput oleh: {row.peran}</div>}
                  {detailItemBanyak && (
                    <div>
                      <div style={{ fontWeight: 600, marginTop: 4 }}>Rincian item:</div>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {row.detail_item.map((d, idx) => (
                          <li key={idx}>
                            {d.nama}
                            {d.jumlah !== undefined && ` — ${d.jumlah}${d.satuan ? ' ' + d.satuan : ''}`}
                            {d.selisih !== undefined && ` — selisih ${d.selisih > 0 ? '+' : ''}${d.selisih}`}
                            {d.qty_asli != null && (
                              <span
                                title={`qty asli: ${d.qty_asli} → ${d.jumlah} oleh ${d.dikoreksi_oleh || '-'} pada ${d.dikoreksi_at ? new Date(d.dikoreksi_at).toLocaleString('id-ID') : '-'}`}
                                style={{
                                  marginLeft: 6,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: 'var(--warna-karamel)',
                                  cursor: 'help',
                                }}
                              >
                                &#9998; Dikoreksi
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!loading && data.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--warna-abu, #6b7280)', padding: 24 }}>
            Tidak ada aktivitas pada rentang ini.
          </p>
        )}
      </div>

      {loading && <p style={{ textAlign: 'center', padding: 16 }}>Memuat...</p>}

      {!loading && hasLebih && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={muatLebih}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1.5px solid var(--warna-garis, #e5e7eb)', background: 'white', cursor: 'pointer' }}
          >
            Muat lebih banyak
          </button>
        </div>
      )}
    </div>
  );
}
