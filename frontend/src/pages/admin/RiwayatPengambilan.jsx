import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { alamatKembali, useUrlFilterDraft } from '../../useUrlFilterDraft';

const FILTER_FIELDS = [{ key: 'search' }, { key: 'dari' }, { key: 'sampai' }];

function formatTanggal(iso) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatJam(iso) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function StatusChip({ label }) {
  if (!label) return null;
  const warna = label === 'Dikoreksi'
    ? { bg: '#FBEAE9', text: 'var(--warna-bahaya)' }
    : { bg: '#E9F3ED', text: 'var(--warna-sukses)' };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: warna.bg, color: warna.text }}>
      {label}
    </span>
  );
}

export default function RiwayatPengambilan() {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { draft, setDraft, filters, terapkan, reset, adaFilter } = useUrlFilterDraft(FILTER_FIELDS);
  const [offset, setOffset] = useState(0);

  const muat = useCallback(async (off = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: 50, offset: off });
      if (filters.search) params.set('search', filters.search);
      if (filters.dari) params.set('dari', filters.dari);
      if (filters.sampai) params.set('sampai', filters.sampai);
      const rows = await api.get(`/sesi-pengambilan-crew?${params}`);
      setData(Array.isArray(rows) ? rows : []);
      setOffset(off);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { muat(0); }, [muat]);

  return (
    <div>
      {/* Filter bar */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input
          className="input-teks"
          type="search"
          placeholder="Cari crew atau outlet..."
          value={draft.search}
          onChange={(e) => setDraft((sebelumnya) => ({ ...sebelumnya, search: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && terapkan()}
          style={{ height: 40, fontSize: 13, flex: '1 1 160px', minWidth: 120 }}
        />
        <input type="date" value={draft.dari} onChange={(e) => setDraft((sebelumnya) => ({ ...sebelumnya, dari: e.target.value }))}
          style={{ height: 40, borderRadius: 8, border: '1.5px solid var(--warna-garis)', padding: '0 10px', fontSize: 13, color: 'var(--warna-arang)' }} />
        <input type="date" value={draft.sampai} onChange={(e) => setDraft((sebelumnya) => ({ ...sebelumnya, sampai: e.target.value }))}
          style={{ height: 40, borderRadius: 8, border: '1.5px solid var(--warna-garis)', padding: '0 10px', fontSize: 13, color: 'var(--warna-arang)' }} />
        <button
          onClick={() => terapkan()}
          style={{ height: 40, padding: '0 16px', borderRadius: 8, border: 'none', background: 'var(--warna-arang)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Filter
        </button>
        {adaFilter && <button onClick={reset} style={{ height: 40, padding: '0 12px', borderRadius: 8, border: '1.5px solid var(--warna-garis)', background: 'white', fontSize: 13, cursor: 'pointer' }}>Reset</button>}
      </div>

      {error && <div className="pesan-error" style={{ margin: '0 16px 10px' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>Memuat...</div>
      ) : data.length === 0 ? (
        <div style={{ padding: '60px 16px', textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>
          Tidak ada data dalam rentang filter ini.
        </div>
      ) : (
        <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 80 }}>
          {data.map((sesi) => (
            <button
              key={sesi.id}
              onClick={() => navigate(`/admin/riwayat-pengambilan/${sesi.id}`, { state: { returnTo: alamatKembali(location) } })}
              style={{
                textAlign: 'left', background: 'white',
                border: '1px solid var(--warna-garis)', borderRadius: 12, padding: '14px', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--warna-abu)' }}>
                  {formatTanggal(sesi.tanggal)} · {formatJam(sesi.created_at)}
                </span>
                {sesi.label_status && <StatusChip label={sesi.label_status} />}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--warna-arang)', marginBottom: 4 }}>
                {sesi.nama_outlet_tujuan}
              </div>
              <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>
                Crew: {sesi.nama_crew} · Gudang: {sesi.nama_gudang_asal}
              </div>
              <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 2 }}>
                {sesi.daftar_item?.length ?? 0} item
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
