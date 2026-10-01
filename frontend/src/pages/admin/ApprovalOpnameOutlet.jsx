import { useState, useEffect } from 'react';
import { api, ApiError } from '../../api/client';

export default function ApprovalOpnameOutlet() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catatanReject, setCatatanReject] = useState({});
  const [loadingAksi, setLoadingAksi] = useState({});
  const [detail, setDetail] = useState({});
  const [memuatDetail, setMemuatDetail] = useState({});
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

  async function toggleDetail(id) {
    if (detail[id]) {
      setDetail(prev => ({ ...prev, [id]: null }));
      return;
    }
    setMemuatDetail(prev => ({ ...prev, [id]: true }));
    try {
      const hasil = await api.get(`/opname-outlet/${id}/detail`);
      setDetail(prev => ({ ...prev, [id]: hasil }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat rincian opname.');
    } finally {
      setMemuatDetail(prev => ({ ...prev, [id]: false }));
    }
  }

  const rupiah = (nilai) => `Rp ${Number(nilai || 0).toLocaleString('id-ID')}`;

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
            Stok fisik: {op.tanggal_opname?.slice(0, 10)} · Periode: {op.periode_dari?.slice(0, 10)} s/d {op.periode_sampai?.slice(0, 10)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginBottom: 12 }}>
            Diinput oleh: {op.dibuat_oleh} · {op.created_at ? new Date(op.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
          </div>
          <button className="tombol tombol--sekunder"
            style={{ width: 'auto', padding: '5px 12px', fontSize: 12, marginBottom: 10 }}
            onClick={() => toggleDetail(op.id)}>
            {memuatDetail[op.id] ? 'Memuat...' : detail[op.id] ? 'Tutup rincian' : 'Lihat rincian HPP'}
          </button>
          {detail[op.id] && (
            <div style={{ marginBottom: 12, borderTop: '1px solid var(--warna-garis)', paddingTop: 8 }}>
              {detail[op.id].items.map(item => (
                <div key={item.item_id} style={{ padding: '7px 0', borderBottom: '1px solid var(--warna-garis)', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <strong>{item.nama}</strong><strong>{rupiah(item.hpp)}</strong>
                  </div>
                  <div style={{ color: 'var(--warna-abu)', marginTop: 2 }}>
                    Awal {item.stok_awal} + Ambil {item.pengambilan} − Akhir {item.stok_akhir ?? 0} = Pakai {item.pemakaian}
                  </div>
                  {item.catatan && <div style={{ color: 'var(--warna-abu)', fontStyle: 'italic', marginTop: 2 }}>{item.catatan}</div>}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13 }}><strong>Total HPP</strong><strong>{rupiah(detail[op.id].items.reduce((sum, item) => sum + Number(item.hpp || 0), 0))}</strong></div>
            </div>
          )}
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
