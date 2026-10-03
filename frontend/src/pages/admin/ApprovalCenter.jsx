import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, urlLengkapUpload } from '../../api/client';

const TAB = [
  ['semua', 'Semua'],
  ['penerimaan', 'Penerimaan'],
  ['transfer', 'Transfer'],
  ['opname_gudang', 'SO Gudang'],
  ['opname_outlet', 'SO Outlet / HPP'],
];

const tanggal = (value) => value
  ? new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '-';
const rupiah = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function ApprovalCenter() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('semua');
  const [error, setError] = useState('');
  const [prosesTransfer, setProsesTransfer] = useState(null);

  async function muat() {
    setError('');
    try {
      setData(await api.get('/dashboard/approval-queue'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat antrean approval.');
    }
  }

  useEffect(() => { muat(); }, []);

  const items = useMemo(() => {
    if (!data?.queues) return [];
    const jenis = tab === 'semua' ? Object.keys(data.queues) : [tab];
    return jenis.flatMap((key) => data.queues[key].map((item) => ({ ...item, jenis: key })));
  }, [data, tab]);

  async function aksiTransfer(item, aksi) {
    const catatan = aksi === 'reject' ? window.prompt('Alasan penolakan (wajib):')?.trim() : null;
    if (aksi === 'reject' && !catatan) return;
    if (aksi === 'approve' && !window.confirm(`Setujui transfer ${item.nama_item} dari ${item.gudang_asal} ke ${item.gudang_tujuan}?`)) return;
    setProsesTransfer(item.id);
    setError('');
    try {
      await api.patch(`/transfer-gudang/${item.id}/verifikasi`, { aksi, catatan }, { idempotencyKey: `approval-center-transfer-${item.id}-${aksi}` });
      await muat();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memproses transfer.');
    } finally {
      setProsesTransfer(null);
    }
  }

  if (!data && !error) return <p style={{ color: 'var(--warna-abu)' }}>Memuat antrean approval...</p>;
  if (!data && error) return (
    <div>
      <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>Approval</h1>
      <div className="pesan-error">{error}</div>
      <button className="tombol tombol--sekunder" style={{ width: 'auto', marginTop: 12 }} onClick={muat}>Coba lagi</button>
    </div>
  );

  return (
    <div style={{ paddingBottom: 28 }}>
      <h1 style={{ fontSize: 24, margin: '0 0 6px' }}>Approval</h1>
      <p style={{ color: 'var(--warna-abu)', fontSize: 13, marginTop: 0, lineHeight: 1.5 }}>
        Satu tempat untuk seluruh keputusan Owner. Setiap transaksi tetap memakai aturan approval dan auditnya masing-masing.
      </p>
      {error && <div className="pesan-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="kartu" style={{ marginBottom: 14, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div><div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>Menunggu keputusan</div><strong style={{ fontSize: 28 }}>{data?.ringkasan?.total ?? 0}</strong></div>
        <div style={{ fontSize: 12, color: 'var(--warna-abu)', lineHeight: 1.6 }}>
          Penerimaan {data?.ringkasan?.penerimaan ?? 0} · Transfer {data?.ringkasan?.transfer ?? 0} · SO Gudang {data?.ringkasan?.opname_gudang ?? 0} · SO Outlet {data?.ringkasan?.opname_outlet ?? 0}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {TAB.map(([id, label]) => {
          const jumlah = id === 'semua' ? data?.ringkasan?.total : data?.ringkasan?.[id];
          return <button key={id} className={`tombol ${tab === id ? 'tombol--primer' : 'tombol--sekunder'}`} style={{ width: 'auto', minWidth: 'max-content', height: 38, padding: '0 13px' }} onClick={() => setTab(id)}>{label} ({jumlah ?? 0})</button>;
        })}
      </div>

      {items.length === 0 ? (
        <div className="kartu" style={{ textAlign: 'center', color: 'var(--warna-abu)', padding: 28 }}>Tidak ada approval yang menunggu.</div>
      ) : items.map((item) => <ApprovalCard key={`${item.jenis}-${item.id ?? item.sesi_id}`} item={item} navigate={navigate} prosesTransfer={prosesTransfer} aksiTransfer={aksiTransfer} />)}

      {(data?.ringkasan?.transfer_menunggu_diterima ?? 0) > 0 && (
        <div className="kartu" style={{ marginTop: 18, background: 'var(--warna-krim-redup)' }}>
          <strong>Dipantau, bukan approval Owner</strong>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--warna-abu)' }}>{data.ringkasan.transfer_menunggu_diterima} transfer sudah disetujui/dikirim dan masih menunggu konfirmasi penerimaan gudang tujuan.</div>
          <button className="tombol tombol--sekunder" style={{ marginTop: 10, width: 'auto', height: 36 }} onClick={() => navigate('/admin/transfer')}>Lihat transfer</button>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ item, navigate, prosesTransfer, aksiTransfer }) {
  const metaStyle = { fontSize: 12, color: 'var(--warna-abu)', marginTop: 4, lineHeight: 1.45 };
  if (item.jenis === 'penerimaan') return (
    <div className="kartu" style={{ marginBottom: 12 }}>
      <strong>Penerimaan · Nota #{item.id} · {item.nama_gudang}</strong>
      <div style={metaStyle}>{item.ringkasan}</div>
      <div style={metaStyle}>Vendor: {item.sumber || 'Belum diisi'} · Diinput {item.dibuat_oleh} ({item.role_input}) · {tanggal(item.created_at)}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {item.foto_bukti_url && <a className="verifikasi-foto-link" href={urlLengkapUpload(item.foto_bukti_url)} target="_blank" rel="noreferrer">Foto bukti →</a>}
        <button className="tombol tombol--primer" style={{ width: 'auto', height: 36 }} onClick={() => navigate('/admin/verifikasi')}>Tinjau & proses</button>
      </div>
    </div>
  );

  if (item.jenis === 'transfer') return (
    <div className="kartu" style={{ marginBottom: 12 }}>
      <strong>Transfer · {item.nama_item}</strong>
      <div style={metaStyle}>{item.gudang_asal} → {item.gudang_tujuan} · {item.jumlah} {item.satuan}</div>
      <div style={metaStyle}>Dikirim oleh {item.dibuat_oleh} · {tanggal(item.tanggal_kirim || item.created_at)}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {item.foto_bukti_kirim_url && <a className="verifikasi-foto-link" href={urlLengkapUpload(item.foto_bukti_kirim_url)} target="_blank" rel="noreferrer">Foto bukti kirim →</a>}
        <button className="tombol tombol--primer" style={{ width: 'auto', height: 36 }} disabled={prosesTransfer === item.id} onClick={() => aksiTransfer(item, 'approve')}>{prosesTransfer === item.id ? <span className="spinner" /> : 'Setujui'}</button>
        <button className="tombol tombol--bahaya" style={{ width: 'auto', height: 36 }} disabled={prosesTransfer === item.id} onClick={() => aksiTransfer(item, 'reject')}>Tolak</button>
      </div>
    </div>
  );

  if (item.jenis === 'opname_gudang') return (
    <div className="kartu" style={{ marginBottom: 12 }}>
      <strong>SO Gudang · {item.nama_gudang}</strong>
      <div style={metaStyle}>Stok fisik {tanggal(item.tanggal_opname)} · {item.jumlah_item} item · Diinput {item.dibuat_oleh}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warna-bahaya)', marginTop: 5 }}>Nilai selisih: {rupiah(item.nilai_selisih)}</div>
      <button className="tombol tombol--primer" style={{ marginTop: 10, width: 'auto', height: 36 }} onClick={() => navigate('/admin/opname/approval')}>Tinjau & proses</button>
    </div>
  );

  return (
    <div className="kartu" style={{ marginBottom: 12 }}>
      <strong>SO Outlet / HPP · {item.nama_outlet}</strong>
      <div style={metaStyle}>Stok fisik {tanggal(item.tanggal_opname)} · Periode {String(item.periode_dari).slice(0, 10)} s/d {String(item.periode_sampai).slice(0, 10)}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 5 }}>Total HPP: {rupiah(item.total_hpp)}</div>
      <button className="tombol tombol--primer" style={{ marginTop: 10, width: 'auto', height: 36 }} onClick={() => navigate('/admin/opname/approval-outlet')}>Tinjau & proses</button>
    </div>
  );
}
