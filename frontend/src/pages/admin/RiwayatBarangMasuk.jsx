import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

function tanggalFormatted(tgl) {
  if (!tgl) return '-';
  const d = new Date(tgl + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusBadge({ label, status }) {
  const teks = label || status || '-';
  const isOk = status === 'terverifikasi';
  const isDitolak = status === 'ditolak';
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
      background: isOk ? '#E9F3ED' : isDitolak ? '#FBEAE9' : '#FDF6EC',
      color: isOk ? '#1a5c36' : isDitolak ? 'var(--warna-bahaya)' : '#7A5420',
    }}>
      {teks}
    </span>
  );
}

export default function RiwayatBarangMasuk() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cari, setCari] = useState('');
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');

  useEffect(() => {
    async function muat() {
      setLoading(true);
      setError(null);
      try {
        const hasil = await api.get('/barang-masuk-nota?status=semua');
        setList(Array.isArray(hasil) ? hasil : []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat barang masuk.');
      } finally {
        setLoading(false);
      }
    }
    muat();
  }, []);

  const filtered = list.filter((row) => {
    if (cari) {
      const q = cari.toLowerCase();
      const inputOleh = (row.diinput_oleh_admin_nama || row.nama_crew_input || '').toLowerCase();
      if (
        !row.nama_gudang?.toLowerCase().includes(q) &&
        !row.sumber?.toLowerCase().includes(q) &&
        !inputOleh.includes(q)
      ) return false;
    }
    if (dari && row.tanggal < dari) return false;
    if (sampai && row.tanggal > sampai) return false;
    return true;
  });

  return (
    <div className="admin-page">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--warna-garis)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--warna-arang)', marginBottom: 12 }}>
          Riwayat Penerimaan
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cari gudang, sumber, penginput..."
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            style={{
              flex: '1 1 180px', height: 38, borderRadius: 8,
              border: '1.5px solid var(--warna-garis)', padding: '0 12px',
              fontSize: 13, color: 'var(--warna-arang)', outline: 'none',
            }}
          />
          <input
            type="date"
            value={dari}
            onChange={(e) => setDari(e.target.value)}
            style={{
              height: 38, borderRadius: 8, border: '1.5px solid var(--warna-garis)',
              padding: '0 10px', fontSize: 13, color: 'var(--warna-arang)', outline: 'none',
            }}
          />
          <input
            type="date"
            value={sampai}
            onChange={(e) => setSampai(e.target.value)}
            style={{
              height: 38, borderRadius: 8, border: '1.5px solid var(--warna-garis)',
              padding: '0 10px', fontSize: 13, color: 'var(--warna-arang)', outline: 'none',
            }}
          />
        </div>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>Memuat...</div>
      )}
      {error && <div className="pesan-error" style={{ margin: 20 }}>{error}</div>}

      {!loading && !error && (
        filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>
            Tidak ada data barang masuk.
          </div>
        ) : (
          <div style={{ padding: '12px 20px', maxWidth: 800 }}>
            {filtered.map((row) => {
              const inputOleh = row.diinput_oleh_admin_nama || row.nama_crew_input || 'Crew';
              const jumlahItem = row.items?.length ?? 0;
              return (
                <button
                  key={row.id}
                  onClick={() => navigate(`/admin/riwayat-barang-masuk/${row.id}`)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'white',
                    border: '1px solid var(--warna-garis)', borderRadius: 12,
                    padding: '14px 16px', marginBottom: 8,
                    cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--warna-arang)' }}>
                        Nota #{row.id}
                      </span>
                      <StatusBadge label={row.label_status} status={row.status_verifikasi} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginBottom: 2 }}>
                      {row.nama_gudang}{row.sumber ? ` · ${row.sumber}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>
                      {jumlahItem} item · {inputOleh} · {tanggalFormatted(row.tanggal)}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--warna-abu)', flexShrink: 0, paddingTop: 2 }}>
                    →
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
