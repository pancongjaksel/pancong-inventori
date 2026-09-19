import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function ApprovalCenterCards({ role }) {
  const [data, setData] = useState(null); const navigate = useNavigate();
  useEffect(() => { api.get('/dashboard/approval-center').then(setData).catch(() => setData(null)); }, []);
  if (!data) return null;
  const isOwner = role === 'owner'; const rows = isOwner ? data.transfer_admin_gudang : data.barang_masuk_crew;
  const count = isOwner ? data.pending_transfer_owner : data.pending_crew_barang_masuk;
  async function aksi(id, action) { const catatan = action === 'approve' ? undefined : window.prompt('Alasan penolakan (wajib):') || undefined; await api.patch(`/transfer-gudang/${id}/verifikasi`, { aksi: action, catatan }, { idempotencyKey: `${id}-${action}` }); setData(await api.get('/dashboard/approval-center')); }
  return <section style={{ marginBottom: 20 }}><h2 style={{ fontSize: 18, marginBottom: 10 }}>Tindakan perlu diproses ({count})</h2>{rows.length === 0 ? <div style={{ color:'var(--warna-abu)' }}>Tidak ada transaksi pending.</div> : rows.map(r => <div key={`${r.jenis}-${r.id}`} style={{ background:'white', border:'1px solid var(--warna-garis)', borderRadius:10, padding:12, marginBottom:8 }}><div style={{ fontWeight:700 }}>{r.lokasi}{r.lokasi_tujuan ? ` → ${r.lokasi_tujuan}` : ''}</div><div style={{ fontSize:12, color:'var(--warna-abu)' }}>{r.ringkasan || '-'} · {r.dibuat_oleh} · {new Date(r.created_at).toLocaleString('id-ID')} · {r.umur_menit} mnt</div><div style={{ marginTop:8, display:'flex', gap:8 }}><button onClick={() => isOwner ? aksi(r.id,'approve') : navigate('/admin-gudang/verifikasi')}>Detail / verifikasi</button>{isOwner && <><button onClick={() => aksi(r.id,'reject')}>Tolak</button></>}</div></div>)}</section>;
}
