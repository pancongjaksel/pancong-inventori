import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';

const PAGE_SIZE = 50;

function waktuFormatted(iso) {
  const d = new Date(iso);
  const sekarang = new Date();
  const sameDay = d.toDateString() === sekarang.toDateString();
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Hari ini, ${jam}`;
  const kemarin = new Date(sekarang); kemarin.setDate(sekarang.getDate() - 1);
  if (d.toDateString() === kemarin.toDateString()) return `Kemarin, ${jam}`;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + `, ${jam}`;
}

function StatusChip({ label }) {
  const warna = label === 'Dikoreksi'
    ? { bg: '#FBEAE9', text: 'var(--warna-bahaya)' }
    : { bg: '#E9F3ED', text: 'var(--warna-sukses)' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: warna.bg, color: warna.text,
    }}>
      {label ?? 'Selesai'}
    </span>
  );
}

export default function CrewRiwayat() {
  const navigate = useNavigate();
  const [sesiList, setSesiList] = useState([]);
  const [filter, setFilter] = useState('semua');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const muat = useCallback(async (f, mulai = 0, reset = true) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ filter: f, limit: String(PAGE_SIZE), offset: String(mulai) });
      // Backend mengambil gudang dari token crew, bukan dari browser.
      const data = await api.get(`/sesi-pengambilan-crew/gudang?${params}`);
      const rows = Array.isArray(data) ? data : [];
      setSesiList((sebelumnya) => reset ? rows : [...sebelumnya, ...rows]);
      setOffset(mulai + rows.length);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { muat(filter); }, [filter, muat]);

  return (
    <div className="mobile-page">
      <div className="mobile-page__content" style={{ padding: 0 }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warna-arang)', marginBottom: 4 }}>
            Riwayat Pengambilan
          </div>
          <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginBottom: 12 }}>
            Semua pengambilan di gudang ini.
          </div>

          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[
              { key: 'semua', label: 'Semua' },
              { key: 'hari-ini', label: 'Hari ini' },
              { key: '7-hari', label: '7 hari' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '6px 14px', borderRadius: 16, fontSize: 12, fontWeight: 600,
                  border: filter === key ? 'none' : '1.5px solid var(--warna-garis)',
                  background: filter === key ? 'var(--warna-arang)' : 'white',
                  color: filter === key ? 'white' : 'var(--warna-abu)',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>
            Memuat riwayat...
          </div>
        ) : error ? (
          <div style={{ padding: '0 16px' }}>
            <div className="pesan-error">{error}</div>
            <button
              onClick={() => muat(filter)}
              style={{
                marginTop: 8, width: '100%', height: 44, borderRadius: 10,
                border: '1.5px solid var(--warna-garis)', background: 'white',
                color: 'var(--warna-arang)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Coba lagi
            </button>
          </div>
        ) : sesiList.length === 0 ? (
          <div style={{ padding: '60px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--warna-arang)', marginBottom: 4 }}>
              Belum ada riwayat
            </div>
            <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>
              {filter === 'hari-ini' ? 'Belum ada pengambilan hari ini.'
                : filter === '7-hari' ? 'Tidak ada pengambilan dalam 7 hari terakhir.'
                  : 'Belum ada riwayat pengambilan.'}
            </div>
          </div>
        ) : (
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 100 }}>
            {sesiList.map((sesi) => (
              <button
                key={sesi.id}
                onClick={() => navigate(`/crew/riwayat/${sesi.id}`)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: 'white', border: '1px solid var(--warna-garis)',
                  borderRadius: 12, padding: '14px', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <StatusChip label={sesi.label_status} />
                  <span style={{ fontSize: 11, color: 'var(--warna-abu)' }}>
                    {waktuFormatted(sesi.created_at)}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--warna-arang)', marginBottom: 2 }}>
                  {sesi.nama_outlet_tujuan}
                </div>
                <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>
                  Diambil oleh {sesi.nama_crew || 'Crew'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 2 }}>
                  {sesi.items?.length ?? 0} item ·{' '}
                  {Number((sesi.items ?? []).reduce((total, item) => total + Number(item.qty || 0), 0)).toLocaleString('id-ID')} unit total
                </div>
              </button>
            ))}
            {hasMore && (
              <button
                className="tombol tombol--sekunder"
                disabled={loading}
                onClick={() => muat(filter, offset, false)}
                style={{ marginTop: 4 }}
              >
                {loading ? 'Memuat...' : 'Muat lebih banyak'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
