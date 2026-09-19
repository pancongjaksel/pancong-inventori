import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

function formatTanggalWaktu(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

const TAB_CONFIG = {
  masuk: { label: 'Penerimaan', tabelTransaksi: 'transaksi_masuk_nota', path: '/barang-masuk-nota?status=terverifikasi' },
  crew: { label: 'Pengeluaran', tabelTransaksi: 'sesi_pengambilan_crew', path: '/sesi-pengambilan-crew' },
  transfer: { label: 'Pemindahan', tabelTransaksi: 'transfer_gudang', path: '/transfer-gudang?status=semua' },
};

// Defense kedua (bukan pengganti reset synchronous di onClick tombol tab):
// row bisa punya shape beda-beda tergantung tabel asalnya (daftar_item buat
// crew, items buat masuk). Guard di sini jaga-jaga kalau suatu saat ada race
// serupa lolos lagi, atau tab baru ditambahkan dengan shape berbeda — jangan
// sampai .length dipanggil ke field yang gak ada di row.
function ringkasanBaris(tab, row) {
  if (tab === 'masuk') {
    if (!Array.isArray(row.items)) return '...';
    return `${row.items.length} item (${row.nama_gudang})`;
  }
  if (tab === 'crew') {
    if (!Array.isArray(row.daftar_item)) return '...';
    return `${row.nama_crew} → ${row.nama_outlet_tujuan} (${row.daftar_item.length} item, ${row.nama_gudang_asal})`;
  }
  return `${row.nama_item} — ${row.jumlah} ${row.satuan} (${row.nama_gudang_asal} → ${row.nama_gudang_tujuan})`;
}

export default function KoreksiTransaksi() {
  const [tab, setTab] = useState('masuk');
  const [daftar, setDaftar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sukses, setSukses] = useState(null);
  const [aksiTerbukaId, setAksiTerbukaId] = useState(null);
  const [alasan, setAlasan] = useState('');
  const [prosesId, setProsesId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  function muatUlang() {
    setLoading(true);
    setError(null);
    api
      .get(TAB_CONFIG[tab].path)
      .then(setDaftar)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }

  useEffect(muatUlang, [tab]);

  async function submitKoreksi(id) {
    if (!alasan.trim()) {
      setError('Alasan koreksi wajib diisi.');
      return;
    }
    setError(null);
    setProsesId(id);
    try {
      await api.post('/koreksi-transaksi', {
        tabelTransaksi: TAB_CONFIG[tab].tabelTransaksi,
        transaksiAsalId: id,
        alasan,
      });
      setSukses('Transaksi berhasil dikoreksi, stok sudah disesuaikan otomatis.');
      setAksiTerbukaId(null);
      setAlasan('');
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal koreksi transaksi.');
    } finally {
      setProsesId(null);
    }
  }

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}
      {sukses && <div className="pesan-sukses">{sukses}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
        {Object.entries(TAB_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            className="tombol tombol--sekunder"
            style={{ width: 'auto', padding: '0 16px', background: tab === key ? 'var(--warna-krim-redup)' : undefined }}
            onClick={() => {
              // Reset daftar (+ loading) SYNCHRONOUS di render yang sama dengan
              // ganti tab — supaya gak pernah ada frame dengan tab baru tapi
              // daftar lama yang shape-nya beda (row.items vs row.daftar_item),
              // yang sebelumnya bikin ringkasanBaris() crash pas ganti tab.
              setTab(key);
              setDaftar([]);
              setLoading(true);
              setAksiTerbukaId(null);
              setSukses(null);
              setExpandedId(null);
            }}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--warna-abu)' }}>Memuat...</p>
      ) : daftar.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--warna-abu)', marginTop: 40 }}>Belum ada riwayat transaksi.</p>
      ) : (
        daftar.map((row) => {
          const sudahDikoreksi = row.label_status === 'Dikoreksi';
          const isExpanded = expandedId === row.id;

          const formKoreksi = (
            aksiTerbukaId === row.id ? (
              <div style={{ marginTop: 10 }}>
                <input
                  className="input-teks"
                  placeholder="Alasan penyesuaian (wajib)"
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="tombol tombol--sekunder" style={{ height: 40 }}
                    onClick={() => { setAksiTerbukaId(null); setAlasan(''); }}>Batal</button>
                  <button className="tombol tombol--bahaya" style={{ height: 40 }}
                    disabled={prosesId === row.id} onClick={() => submitKoreksi(row.id)}>
                    {prosesId === row.id ? <span className="spinner" /> : 'Konfirmasi'}
                  </button>
                </div>
              </div>
            ) : (
              <button className="tombol tombol--sekunder"
                style={{ height: 36, width: 'auto', padding: '0 14px', marginTop: 10, fontSize: 13 }}
                onClick={() => { setAksiTerbukaId(row.id); setAlasan(''); setSukses(null); }}>
                Buat penyesuaian
              </button>
            )
          );

          if (tab === 'masuk') {
            return (
              <div key={row.id} className="kartu" style={{ marginBottom: 12, opacity: sudahDikoreksi ? 0.6 : 1 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', cursor: !sudahDikoreksi ? 'pointer' : 'default' }}
                  onClick={() => !sudahDikoreksi && setExpandedId(isExpanded ? null : row.id)}
                >
                  <div style={{ fontSize: 14 }}>{ringkasanBaris(tab, row)}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {sudahDikoreksi && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-bahaya)' }}>DISESUAIKAN</span>
                    )}
                    {!sudahDikoreksi && (
                      <span style={{ fontSize: 13, color: 'var(--warna-abu)' }}>{isExpanded ? '▲' : '▼'}</span>
                    )}
                  </div>
                </div>
                {!sudahDikoreksi && isExpanded && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--warna-garis)', fontSize: 13 }}>
                    <div style={{ marginBottom: 8, color: 'var(--warna-abu)' }}>
                      {formatTanggalWaktu(row.created_at)}
                      {row.nama_gudang ? ` · ${row.nama_gudang}` : ''}
                      {row.sumber ? ` · ${row.sumber}` : ''}
                    </div>
                    {(row.items || []).map((itm, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }}>
                        <span>{itm.nama_item}</span>
                        <span style={{ color: 'var(--warna-abu)' }}>{itm.jumlah} {itm.satuan}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 10 }}>{formKoreksi}</div>
                  </div>
                )}
              </div>
            );
          }

          if (tab === 'crew') {
            return (
              <div key={row.id} className="kartu" style={{ marginBottom: 12, opacity: sudahDikoreksi ? 0.6 : 1 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', cursor: 'pointer' }}
                  onClick={() => {
                    setExpandedId(isExpanded ? null : row.id);
                    if (!isExpanded) { setAksiTerbukaId(null); setAlasan(''); }
                  }}
                >
                  <div style={{ fontSize: 14 }}>{ringkasanBaris(tab, row)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {sudahDikoreksi && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-bahaya)', whiteSpace: 'nowrap' }}>DISESUAIKAN</span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--warna-abu)' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                {isExpanded && (
                  <>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--warna-garis)', fontSize: 13, color: 'var(--warna-arang)' }}>
                      <div style={{ marginBottom: 8, color: 'var(--warna-abu)' }}>{formatTanggalWaktu(row.created_at)}</div>
                      {Array.isArray(row.daftar_item) && row.daftar_item.map((itm, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }}>
                          <span>{itm.item}</span>
                          <span style={{ color: 'var(--warna-abu)' }}>{itm.qty} {itm.satuan}</span>
                        </div>
                      ))}
                    </div>
                    {!sudahDikoreksi && formKoreksi}
                  </>
                )}
              </div>
            );
          }

          // transfer — flat, no accordion
          return (
            <div key={row.id} className="kartu" style={{ marginBottom: 12, opacity: sudahDikoreksi ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ fontSize: 14 }}>{ringkasanBaris(tab, row)}</div>
                {sudahDikoreksi && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-bahaya)', whiteSpace: 'nowrap' }}>DISESUAIKAN</span>
                )}
              </div>
              {!sudahDikoreksi && formKoreksi}
            </div>
          );
        })
      )}
    </div>
  );
}
