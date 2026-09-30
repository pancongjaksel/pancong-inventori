import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

const formatTanggal = (iso) => iso
  ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  : '-';

const labelFase = (fase, jenis) => {
  if (fase === 'closing') return 'closing periode';
  if (fase === 'baseline') return 'baseline awal';
  if (fase === 'legacy') return 'catatan lama — bukan closing';
  return jenis;
};

const formatRupiah = (nilai) => `Rp ${Number(nilai || 0).toLocaleString('id-ID')}`;

export default function ApprovalOpname() {
  const [daftar, setDaftar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sukses, setSukses] = useState(null);
  const [expandedSesi, setExpandedSesi] = useState(null);
  const [detailSesi, setDetailSesi] = useState({});
  const [editId, setEditId] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [approvalSesiId, setApprovalSesiId] = useState(null);
  const [sesuaikanStok, setSesuaikanStok] = useState(false);
  const [proses, setProses] = useState(false);
  const [loadingSesi, setLoadingSesi] = useState({});
  const [selisihClosing, setSelisihClosing] = useState(null);

  function muat() {
    setLoading(true);
    Promise.all([api.get('/stok-opname/approval'), api.get('/stok-opname/closing/selisih')])
      .then(([sesi, selisih]) => { setDaftar(sesi); setSelisihClosing(selisih); })
      .catch(() => setError('Gagal memuat data approval.'))
      .finally(() => setLoading(false));
  }
  useEffect(muat, []);

  async function bukaSesi(sesiId) {
    if (expandedSesi === sesiId) { setExpandedSesi(null); return; }
    setExpandedSesi(sesiId);
    if (detailSesi[sesiId]) return;
    setLoadingSesi(prev => ({ ...prev, [sesiId]: true }));
    try {
      const detail = await api.get(`/stok-opname/sesi/${sesiId}`);
      setDetailSesi(prev => ({ ...prev, [sesiId]: detail }));
    } catch {
      setError('Gagal memuat detail sesi.');
    } finally {
      setLoadingSesi(prev => ({ ...prev, [sesiId]: false }));
    }
  }

  async function simpanEdit(id, sesiId) {
    try {
      await api.patch(`/stok-opname/item/${id}`, { stokFisik: parseFloat(editQty) });
      const detail = await api.get(`/stok-opname/sesi/${sesiId}`);
      setDetailSesi(prev => ({ ...prev, [sesiId]: detail }));
      setEditId(null);
      setEditQty('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal simpan edit.');
    }
  }

  async function approve(sesiId) {
    setProses(true); setError(null); setSukses(null);
    try {
      const hasil = await api.post(`/stok-opname/sesi/${sesiId}/approve`, { sesuaikanStok });
      setSukses(`Sesi diapprove. ${hasil.totalItem} item, ${hasil.totalDisesuaikan} disesuaikan ke stok sistem.`);
      setApprovalSesiId(null);
      setExpandedSesi(null);
      setSesuaikanStok(false);
      muat();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal approve.');
    } finally { setProses(false); }
  }

  if (loading) return <p style={{ color: 'var(--warna-abu)' }}>Memuat...</p>;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}
      {sukses && <div className="pesan-sukses">{sukses}</div>}

      {selisihClosing?.ringkasan?.jumlah_baris > 0 && (
        <section className="kartu" style={{ marginBottom: 16, border: '1.5px solid #e6c394' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Ringkasan Selisih Closing Gudang</div>
          <div style={{ fontSize: 13, color: 'var(--warna-abu)', marginBottom: 12 }}>
            {selisihClosing.ringkasan.jumlah_baris} item berbeda dari stok sistem. Nilai memakai harga master item saat ini.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14, fontSize: 13 }}>
            <span><strong>Kekurangan fisik:</strong> {formatRupiah(selisihClosing.ringkasan.nilai_kekurangan)}</span>
            <span><strong>Kelebihan fisik:</strong> {formatRupiah(selisihClosing.ringkasan.nilai_kelebihan)}</span>
            <span><strong>Total nilai selisih:</strong> {formatRupiah(selisihClosing.ringkasan.total_nilai_selisih)}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ color: 'var(--warna-abu)', textAlign: 'left' }}>
                <th style={{ padding: '6px 4px' }}>Gudang</th><th style={{ padding: '6px 4px' }}>Item</th><th style={{ padding: '6px 4px', textAlign: 'right' }}>Sistem</th><th style={{ padding: '6px 4px', textAlign: 'right' }}>Fisik</th><th style={{ padding: '6px 4px', textAlign: 'right' }}>Selisih</th><th style={{ padding: '6px 4px', textAlign: 'right' }}>Nilai</th>
              </tr></thead>
              <tbody>{selisihClosing.items.map((item) => (
                <tr key={`${item.sesi_id}-${item.kode_barang}`} style={{ borderTop: '1px solid var(--warna-garis)' }}>
                  <td style={{ padding: '8px 4px' }}>{item.nama_gudang}</td><td style={{ padding: '8px 4px' }}>{item.nama_item}<div style={{ color: 'var(--warna-abu)' }}>{item.satuan}</div></td><td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.stok_sistem}</td><td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.stok_fisik}</td><td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: Number(item.selisih) > 0 ? 'var(--warna-bahaya)' : 'var(--warna-sukses)' }}>{Number(item.selisih) > 0 ? '-' : '+'}{Math.abs(Number(item.selisih))}</td><td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>{formatRupiah(item.nilai_selisih)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      {daftar.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--warna-abu)', marginTop: 40 }}>
          Tidak ada opname yang menunggu approval.
        </p>
      ) : daftar.map(sesi => (
        <div key={sesi.sesi_id} className="kartu" style={{ marginBottom: 12 }}>
          <div
            onClick={() => bukaSesi(sesi.sesi_id)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', cursor: 'pointer' }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{sesi.nama_gudang}</div>
              <div style={{ fontSize: 13, color: 'var(--warna-abu)', marginTop: 2 }}>
                {formatTanggal(sesi.tanggal)} · {labelFase(sesi.fase_periode, sesi.jenis_opname)} · {sesi.jumlah_item} item
                {sesi.dicatat_oleh ? ` · oleh ${sesi.dicatat_oleh}` : ''}
              </div>
              {Number(sesi.total_selisih) > 0 && (
                <div style={{ fontSize: 12, color: 'var(--warna-bahaya)', marginTop: 2 }}>
                  Total selisih: {sesi.total_selisih}
                </div>
              )}
            </div>
            <span style={{ fontSize: 13, color: 'var(--warna-abu)' }}>
              {expandedSesi === sesi.sesi_id ? '▲' : '▼'}
            </span>
          </div>

          {expandedSesi === sesi.sesi_id && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--warna-garis)', paddingTop: 12 }}>
              {loadingSesi[sesi.sesi_id] ? (
                <p style={{ color: 'var(--warna-abu)', fontSize: 13 }}>Memuat detail...</p>
              ) : (<>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, fontSize: 11, color: 'var(--warna-abu)', marginBottom: 6, padding: '0 4px' }}>
                <span>Item</span>
                <span style={{ textAlign: 'right' }}>Sistem</span>
                <span style={{ textAlign: 'right' }}>Fisik</span>
                <span style={{ textAlign: 'right' }}>Selisih</span>
                <span></span>
              </div>

              {(detailSesi[sesi.sesi_id] || []).map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, fontSize: 13, padding: '6px 4px', borderTop: '1px solid var(--warna-garis)', alignItems: 'center' }}>
                  <span>{item.nama_item} <span style={{ color: 'var(--warna-abu)', fontSize: 11 }}>{item.satuan}</span></span>
                  <span style={{ textAlign: 'right' }}>{item.stok_sistem}</span>
                  <span style={{ textAlign: 'right' }}>
                    {editId === item.id ? (
                      <input
                        type="number" min="0"
                        className="input-teks"
                        style={{ width: 70, height: 32, textAlign: 'right' }}
                        value={editQty}
                        onChange={e => setEditQty(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && simpanEdit(item.id, sesi.sesi_id)}
                        autoFocus
                      />
                    ) : item.stok_fisik}
                  </span>
                  <span style={{ textAlign: 'right', fontWeight: 600, color: Number(item.selisih) !== 0 ? 'var(--warna-bahaya)' : 'var(--warna-abu)' }}>
                    {Number(item.selisih) > 0 ? `+${item.selisih}` : item.selisih}
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    {editId === item.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="tombol tombol--sekunder" style={{ height: 28, width: 'auto', padding: '0 8px', fontSize: 11 }}
                          onClick={() => { setEditId(null); setEditQty(''); }}>Batal</button>
                        <button className="tombol tombol--primer" style={{ height: 28, width: 'auto', padding: '0 8px', fontSize: 11 }}
                          onClick={() => simpanEdit(item.id, sesi.sesi_id)}>Simpan</button>
                      </div>
                    ) : (
                      <button className="tombol tombol--sekunder" style={{ height: 28, width: 'auto', padding: '0 8px', fontSize: 11 }}
                        onClick={() => { setEditId(item.id); setEditQty(String(item.stok_fisik)); }}>Edit</button>
                    )}
                  </span>
                </div>
              ))}

              {approvalSesiId === sesi.sesi_id ? (
                <div style={{ marginTop: 14, padding: '12px', background: 'var(--warna-krim-redup)', borderRadius: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={sesuaikanStok}
                      onChange={e => setSesuaikanStok(e.target.checked)} />
                    Sesuaikan stok sistem dengan hasil opname ini
                  </label>
                  <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginBottom: 12 }}>
                    {sesuaikanStok
                      ? 'Stok sistem akan diupdate mengikuti stok fisik. Item tanpa selisih tidak terpengaruh.'
                      : 'Data opname disimpan sebagai catatan, stok sistem tidak berubah.'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="tombol tombol--sekunder" style={{ width: 'auto', padding: '0 14px', height: 36 }}
                      onClick={() => { setApprovalSesiId(null); setSesuaikanStok(false); }}>Batal</button>
                    <button className="tombol tombol--primer" style={{ width: 'auto', padding: '0 18px', height: 36 }}
                      disabled={proses} onClick={() => approve(sesi.sesi_id)}>
                      {proses ? <span className="spinner" /> : 'Konfirmasi Approve'}
                    </button>
                  </div>
                </div>
              ) : (
                <button className="tombol tombol--primer"
                  style={{ marginTop: 14, width: 'auto', padding: '0 18px', height: 36 }}
                  onClick={() => setApprovalSesiId(sesi.sesi_id)}>
                  Approve Sesi Ini
                </button>
              )}
              </>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
