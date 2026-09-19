import { useState, useEffect } from 'react';
import { api, ApiError } from '../../api/client';

export default function ApprovalOpnameOutlet() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catatanReject, setCatatanReject] = useState({});
  const [loadingAksi, setLoadingAksi] = useState({});
  const [error, setError] = useState('');

  async function muatPending() {
    setLoading(true);
    try {
      const data = await api.get('/opname-outlet/pending');
      setList(data || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { muatPending(); }, []);

  async function handleApprove(id) {
    setLoadingAksi(prev => ({ ...prev, [id]: true }));
    try {
      await api.put(`/opname-outlet/${id}/approve`, {});
      await muatPending();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal approve.');
    } finally {
      setLoadingAksi(prev => ({ ...prev, [id]: false }));
    }
  }

  async function handleReject(id) {
    const catatan = catatanReject[id]?.trim();
    if (!catatan) {
      setError('Isi alasan penolakan dulu.');
      return;
    }
    setLoadingAksi(prev => ({ ...prev, [id]: true }));
    try {
      await api.put(`/opname-outlet/${id}/reject`, { catatan_approval: catatan });
      await muatPending();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal tolak.');
    } finally {
      setLoadingAksi(prev => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div>
      <p className="label">Approval Opname Outlet</p>
      {error && <div className="pesan-error" style={{ marginBottom: 12 }}>{error}</div>}
      {loading && <p style={{ fontSize: 14, color: 'var(--warna-abu)' }}>Memuat...</p>}
      {!loading && list.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--warna-abu)' }}>Tidak ada opname yang menunggu approval.</p>
      )}
      {list.map(op => (
        <div key={op.id} className="kartu" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{op.nama_outlet}</div>
          <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginBottom: 4 }}>
            Tanggal: {op.tanggal_opname?.slice(0, 10)} · Periode: {op.periode_dari?.slice(0, 10)} s/d {op.periode_sampai?.slice(0, 10)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginBottom: 12 }}>
            Dikirim oleh: {op.dibuat_oleh}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="tombol tombol--primer"
              style={{ width: 'auto', padding: '6px 16px' }}
              onClick={() => handleApprove(op.id)}
              disabled={loadingAksi[op.id]}>
              {loadingAksi[op.id] ? <span className="spinner" /> : '✓ Approve'}
            </button>
            <div style={{ flex: 1, minWidth: 160 }}>
              <input type="text" className="input-teks"
                placeholder="Alasan penolakan..."
                value={catatanReject[op.id] || ''}
                onChange={e => setCatatanReject(prev => ({ ...prev, [op.id]: e.target.value }))}
                style={{ width: '100%' }} />
            </div>
            <button className="tombol tombol--sekunder"
              style={{ width: 'auto', padding: '6px 16px', color: 'var(--warna-bahaya)' }}
              onClick={() => handleReject(op.id)}
              disabled={loadingAksi[op.id]}>
              ✕ Tolak
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
