import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

function tanggalFormatted(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusBadge({ label, status }) {
  const teks = label || (status === 'ditolak' ? 'Ditolak' : status) || '-';
  const isDiterima = status === 'diterima' || teks === 'Diterima';
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
      background: isDiterima ? '#E9F3ED' : '#FDF6EC',
      color: isDiterima ? '#1a5c36' : '#7A5420',
    }}>
      {teks}
    </span>
  );
}

export default function RiwayatTransfer() {
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
        const hasil = await api.get('/transfer-gudang?status=semua');
        setList(Array.isArray(hasil) ? hasil : []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat transfer.');
      } finally {
        setLoading(false);
      }
    }
    muat();
  }, []);

  const filtered = list.filter((row) => {
    if (cari) {
      const q = cari.toLowerCase();
      if (
        !row.nama_item?.toLowerCase().includes(q) &&
        !row.nama_gudang_asal?.toLowerCase().includes(q) &&
        !row.nama_gudang_tujuan?.toLowerCase().includes(q) &&
        !row.dikirim_oleh_nama?.toLowerCase().includes(q)
      ) return false;
    }
    if (dari) {
      const tgl = row.tanggal_kirim ? row.tanggal_kirim.slice(0, 10) : '';
      if (tgl < dari) return false;
    }
    if (sampai) {
      const tgl = row.tanggal_kirim ? row.tanggal_kirim.slice(0, 10) : '';
      if (tgl > sampai) return false;
    }
    return true;
  });

  return (
    <div className="admin-page">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--warna-garis)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--warna-arang)', marginBottom: 12 }}>
          Riwayat Pemindahan
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cari item, gudang, pengirim..."
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
            Tidak ada data transfer.
          </div>
        ) : (
          <div style={{ padding: '12px 20px', maxWidth: 800 }}>
            {filtered.map((row) => (
              <button
                key={row.id}
                onClick={() => navigate(`/admin/riwayat-transfer/${row.id}`)}
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
                      {row.nama_item}
                    </span>
                    <StatusBadge label={row.label_status} status={row.status} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginBottom: 2 }}>
                    {row.nama_gudang_asal} → {row.nama_gudang_tujuan}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>
                    Oleh {row.dikirim_oleh_nama} · {tanggalFormatted(row.tanggal_kirim)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-angka)', fontSize: 18, fontWeight: 800, color: 'var(--warna-arang)' }}>
                    {Number(row.jumlah).toLocaleString('id-ID')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginTop: 1 }}>{row.satuan}</div>
                </div>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
