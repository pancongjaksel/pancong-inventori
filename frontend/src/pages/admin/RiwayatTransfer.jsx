import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { alamatKembali, useUrlFilterDraft } from '../../useUrlFilterDraft';

const PAGE_SIZE = 50;
const FILTER_FIELDS = [{ key: 'search' }, { key: 'dari' }, { key: 'sampai' }];

function waktuFormatted(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin-gudang') ? '/admin-gudang' : '/admin';
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { draft, setDraft, filters, terapkan, reset, adaFilter } = useUrlFilterDraft(FILTER_FIELDS);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const muat = useCallback(async (resetList = false) => {
      const mulai = resetList ? 0 : offset;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ status: 'semua', limit: String(PAGE_SIZE), offset: String(mulai) });
        if (filters.search) params.set('search', filters.search);
        if (filters.dari) params.set('dari', filters.dari);
        if (filters.sampai) params.set('sampai', filters.sampai);
        const hasil = await api.get(`/transfer-gudang?${params}`);
        const rows = Array.isArray(hasil) ? hasil : [];
        setList((sebelumnya) => resetList ? rows : [...sebelumnya, ...rows]);
        setOffset(mulai + rows.length);
        setHasMore(rows.length === PAGE_SIZE);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat transfer.');
      } finally {
        setLoading(false);
      }
  }, [filters, offset]);

  useEffect(() => { muat(true); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

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
            value={draft.search}
            onChange={(e) => setDraft((sebelumnya) => ({ ...sebelumnya, search: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && terapkan()}
            style={{
              flex: '1 1 180px', height: 38, borderRadius: 8,
              border: '1.5px solid var(--warna-garis)', padding: '0 12px',
              fontSize: 13, color: 'var(--warna-arang)', outline: 'none',
            }}
          />
          <input
            type="date"
            value={draft.dari}
            onChange={(e) => setDraft((sebelumnya) => ({ ...sebelumnya, dari: e.target.value }))}
            style={{
              height: 38, borderRadius: 8, border: '1.5px solid var(--warna-garis)',
              padding: '0 10px', fontSize: 13, color: 'var(--warna-arang)', outline: 'none',
            }}
          />
          <button className="tombol tombol--primer" onClick={() => terapkan()}>Filter</button>
          <input
            type="date"
            value={draft.sampai}
            onChange={(e) => setDraft((sebelumnya) => ({ ...sebelumnya, sampai: e.target.value }))}
            style={{
              height: 38, borderRadius: 8, border: '1.5px solid var(--warna-garis)',
              padding: '0 10px', fontSize: 13, color: 'var(--warna-arang)', outline: 'none',
            }}
          />
          {adaFilter && <button className="tombol tombol--sekunder" onClick={reset}>Reset</button>}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>Memuat...</div>
      )}
      {error && <div className="pesan-error" style={{ margin: 20 }}>{error}</div>}

      {!loading && !error && (
        list.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>
            Tidak ada data transfer.
          </div>
        ) : (
          <div style={{ padding: '12px 20px', maxWidth: 800 }}>
            {list.map((row) => (
              <button
                key={row.id}
                onClick={() => navigate(`${basePath}/riwayat-transfer/${row.id}`, { state: { returnTo: alamatKembali(location) } })}
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
                    Dikirim oleh {row.dikirim_oleh_nama} · {waktuFormatted(row.tanggal_kirim)}
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
            {hasMore && (
              <button className="tombol tombol--sekunder" disabled={loading} onClick={() => muat(false)} style={{ alignSelf: 'center', margin: '8px 0 20px' }}>
                {loading ? 'Memuat...' : 'Muat lebih banyak'}
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
