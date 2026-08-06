import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

const TAB_CONFIG = {
  masuk: { label: 'Barang Masuk', tabelTransaksi: 'transaksi_masuk', path: '/barang-masuk?status=terverifikasi' },
  crew: { label: 'Pengambilan Crew', tabelTransaksi: 'sesi_pengambilan_crew', path: '/sesi-pengambilan-crew' },
  transfer: { label: 'Transfer Gudang', tabelTransaksi: 'transfer_gudang', path: '/transfer-gudang?status=semua' },
};

function ringkasanBaris(tab, row) {
  if (tab === 'masuk') return `${row.nama_item} — ${row.jumlah} ${row.satuan} (${row.nama_gudang})`;
  if (tab === 'crew') return `${row.nama_crew} → ${row.nama_outlet_tujuan} (${row.daftar_item.length} item, ${row.nama_gudang_asal})`;
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
            onClick={() => { setTab(key); setAksiTerbukaId(null); setSukses(null); }}
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
          return (
            <div key={row.id} className="kartu" style={{ marginBottom: 12, opacity: sudahDikoreksi ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ fontSize: 14 }}>{ringkasanBaris(tab, row)}</div>
                {sudahDikoreksi && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-bahaya)', whiteSpace: 'nowrap' }}>DIKOREKSI</span>
                )}
              </div>

              {!sudahDikoreksi && (
                aksiTerbukaId === row.id ? (
                  <div style={{ marginTop: 10 }}>
                    <input
                      className="input-teks"
                      placeholder="Alasan koreksi (wajib)"
                      value={alasan}
                      onChange={(e) => setAlasan(e.target.value)}
                      style={{ marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="tombol tombol--sekunder" style={{ height: 40 }} onClick={() => { setAksiTerbukaId(null); setAlasan(''); }}>
                        Batal
                      </button>
                      <button
                        className="tombol tombol--bahaya"
                        style={{ height: 40 }}
                        disabled={prosesId === row.id}
                        onClick={() => submitKoreksi(row.id)}
                      >
                        {prosesId === row.id ? <span className="spinner" /> : 'Konfirmasi koreksi'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="tombol tombol--sekunder"
                    style={{ height: 36, width: 'auto', padding: '0 14px', marginTop: 10, fontSize: 13 }}
                    onClick={() => { setAksiTerbukaId(row.id); setAlasan(''); setSukses(null); }}
                  >
                    Koreksi transaksi ini
                  </button>
                )
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
