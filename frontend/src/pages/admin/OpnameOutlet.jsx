import { useState, useEffect } from 'react';
import { api, ApiError } from '../../api/client';

function hariIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function awalBulanIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function OpnameOutlet() {
  const [outlets, setOutlets] = useState([]);
  const [items, setItems] = useState([]);
  const [outletId, setOutletId] = useState('');
  const [tanggalOpname, setTanggalOpname] = useState(hariIni());
  const [periodeDari, setPeriodeDari] = useState(awalBulanIni());
  const [periodeSampai, setSampaiTanggal] = useState(hariIni());
  const [rows, setRows] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingSimpan, setLoadingSimpan] = useState(false);
  const [error, setError] = useState('');
  const [sukses, setSukses] = useState('');

  const [riwayat, setRiwayat] = useState([]);
  const [modeEdit, setModeEdit] = useState(false);
  const [opnameIdEdit, setOpnameIdEdit] = useState(null);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);

  useEffect(() => {
    api.get('/opname-outlet/outlets').then(d => setOutlets(d || [])).catch(() => {});
    api.get('/opname-outlet/items').then(d => setItems(d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!outletId) { setRiwayat([]); return; }
    setLoadingRiwayat(true);
    api.get(`/opname-outlet/riwayat/${outletId}`)
      .then(d => setRiwayat(d || []))
      .catch(() => setRiwayat([]))
      .finally(() => setLoadingRiwayat(false));
  }, [outletId]);

  async function muatFormBaru() {
    if (!outletId || !periodeDari || !periodeSampai) {
      setError('Pilih outlet dan periode dulu.');
      return;
    }
    setError(''); setSukses(''); setLoadingPreview(true); setModeEdit(false); setOpnameIdEdit(null);
    try {
      const params = new URLSearchParams({ outlet_id: outletId, dari: periodeDari, sampai: periodeSampai });
      const [preview, stokAwalAll] = await Promise.all([
        api.get(`/opname-outlet/pengambilan-preview?${params}`),
        Promise.all(items.map(item =>
          api.get(`/opname-outlet/stok-awal/${outletId}/${item.id}`)
            .then(d => ({ item_id: item.id, stok_awal: d?.stok_awal ?? 0 }))
            .catch(() => ({ item_id: item.id, stok_awal: 0 }))
        ))
      ]);
      const stokAwalMap = {};
      stokAwalAll.forEach(s => { stokAwalMap[s.item_id] = s.stok_awal; });

      setRows(items.map(item => ({
        item_id: item.id,
        nama: item.nama,
        kode_barang: item.kode_barang,
        satuan: item.satuan,
        harga: Number(item.harga),
        stok_awal: stokAwalMap[item.id] ?? 0,
        pengambilan: preview[item.id] ?? 0,
        stok_akhir: '',
        catatan: '',
      })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data.');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function muatFormEdit(opname) {
    setError(''); setSukses(''); setModeEdit(true); setOpnameIdEdit(opname.id);
    setTanggalOpname(opname.tanggal_opname?.slice(0, 10));
    setPeriodeDari(opname.periode_dari?.slice(0, 10));
    setSampaiTanggal(opname.periode_sampai?.slice(0, 10));
    try {
      const data = await api.get(`/opname-outlet/laporan?opname_id=${opname.id}`);
      setRows(data.items.map(item => ({
        item_id: items.find(i => i.kode_barang === item.kode_barang)?.id,
        nama: item.nama,
        kode_barang: item.kode_barang,
        satuan: item.satuan,
        harga: Number(item.harga),
        stok_awal: Number(item.stok_awal),
        pengambilan: Number(item.pengambilan),
        stok_akhir: item.stok_akhir !== null ? String(item.stok_akhir) : '',
        catatan: item.catatan ?? '',
      })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data opname.');
    }
  }

  function updateRow(item_id, field, value) {
    setRows(prev => prev.map(r => r.item_id === item_id ? { ...r, [field]: value } : r));
  }

  function hitungPemakaian(row) {
    const awal = Number(row.stok_awal) || 0;
    const ambil = Number(row.pengambilan) || 0;
    const akhir = row.stok_akhir !== '' ? Number(row.stok_akhir) : null;
    if (akhir === null) return '-';
    return awal + ambil - akhir;
  }

  function hitungHpp(row) {
    const pemakaian = hitungPemakaian(row);
    if (pemakaian === '-') return null;
    return pemakaian * row.harga;
  }

  async function handleSimpan() {
    const rowsLengkap = rows.filter(r => r.stok_akhir !== '');
    if (!rowsLengkap.length) {
      setError('Isi stok akhir minimal satu item dulu.');
      return;
    }
    setError(''); setSukses(''); setLoadingSimpan(true);
    try {
      if (modeEdit) {
        await api.put(`/opname-outlet/${opnameIdEdit}`, {
          items: rowsLengkap.map(r => ({
            item_id: r.item_id,
            stok_akhir: Number(r.stok_akhir),
            catatan: r.catatan || null,
          }))
        });
        setSukses('Opname berhasil diperbarui.');
      } else {
        await api.post('/opname-outlet', {
          outlet_id: Number(outletId),
          tanggal_opname: tanggalOpname,
          periode_dari: periodeDari,
          periode_sampai: periodeSampai,
          items: rowsLengkap.map(r => ({
            item_id: r.item_id,
            stok_awal: Number(r.stok_awal),
            pengambilan: Number(r.pengambilan),
            stok_akhir: Number(r.stok_akhir),
            harga: r.harga,
            catatan: r.catatan || null,
          }))
        });
        setSukses('Opname berhasil disimpan.');
        const d = await api.get(`/opname-outlet/riwayat/${outletId}`);
        setRiwayat(d || []);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan opname.');
    } finally {
      setLoadingSimpan(false);
    }
  }

  const formatRupiah = (nilai) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nilai ?? 0);

  const totalHpp = rows.reduce((sum, r) => {
    const hpp = hitungHpp(r);
    return sum + (hpp ?? 0);
  }, 0);

  return (
    <div>
      <div className="riwayat-filter" style={{ flexWrap: 'wrap', gap: 8 }}>
        <select
          className="input-teks"
          value={outletId}
          onChange={e => { setOutletId(e.target.value); setRows([]); setSukses(''); setError(''); }}
          style={{ width: 'auto', padding: '0 12px' }}
        >
          <option value="">Pilih outlet</option>
          {outlets.map(o => <option key={o.id} value={o.id}>{o.nama}</option>)}
        </select>
        <input type="date" className="input-teks" value={periodeDari}
          onChange={e => setPeriodeDari(e.target.value)} style={{ width: 'auto' }} />
        <span style={{ alignSelf: 'center', color: 'var(--warna-abu)', fontSize: 13 }}>s/d</span>
        <input type="date" className="input-teks" value={periodeSampai}
          onChange={e => setSampaiTanggal(e.target.value)} style={{ width: 'auto' }} />
        <input type="date" className="input-teks" value={tanggalOpname}
          onChange={e => setTanggalOpname(e.target.value)} style={{ width: 'auto' }}
          title="Tanggal opname (boleh mundur)" />
        <button
          className="tombol tombol--primer"
          style={{ width: 'auto', padding: '0 20px' }}
          onClick={muatFormBaru}
          disabled={loadingPreview || !outletId}
        >
          {loadingPreview ? <span className="spinner" /> : 'Buat Opname Baru'}
        </button>
      </div>

      {error && <div className="pesan-error" style={{ marginTop: 8 }}>{error}</div>}
      {sukses && <div className="pesan-sukses" style={{ marginTop: 8 }}>{sukses}</div>}

      {outletId && (
        <div style={{ marginTop: 16 }}>
          <p className="label">Riwayat Opname</p>
          {loadingRiwayat && <p style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Memuat riwayat...</p>}
          {!loadingRiwayat && riwayat.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Belum ada opname untuk outlet ini.</p>
          )}
          {riwayat.map(op => (
            <div key={op.id} className="kartu" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{op.tanggal_opname?.slice(0, 10)}</div>
                <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>
                  Periode {op.periode_dari?.slice(0, 10)} s/d {op.periode_sampai?.slice(0, 10)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>oleh {op.dibuat_oleh}</div>
                <div style={{
                  display: 'inline-block', fontSize: 11, padding: '2px 8px',
                  borderRadius: 10, marginTop: 4,
                  background: op.status === 'approved' ? 'var(--warna-karamel)'
                    : op.status === 'ditolak' ? '#fee2e2'
                    : 'var(--warna-krim-redup)',
                  color: op.status === 'approved' ? 'white'
                    : op.status === 'ditolak' ? 'var(--warna-bahaya)'
                    : 'var(--warna-arang)',
                }}>
                  {op.status === 'approved' ? 'Disetujui'
                    : op.status === 'ditolak' ? `Ditolak: ${op.catatan_approval}`
                    : 'Menunggu Approval'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-angka)', fontWeight: 700, fontSize: 14 }}>
                  {formatRupiah(op.total_hpp)}
                </div>
                <button
                  className="tombol tombol--sekunder"
                  style={{ width: 'auto', padding: '4px 12px', fontSize: 12, marginTop: 4 }}
                  onClick={() => muatFormEdit(op)}
                  disabled={op.status === 'approved'}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p className="label">
            {modeEdit ? `Edit Opname ${tanggalOpname}` : `Opname Baru — ${tanggalOpname}`}
          </p>
          {rows.map(row => {
            const pemakaian = hitungPemakaian(row);
            const hpp = hitungHpp(row);
            return (
              <div key={row.item_id} className="kartu" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{row.nama}</div>
                    <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>{row.kode_barang} · {row.satuan}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--warna-abu)' }}>
                    <div>Awal: {row.stok_awal}</div>
                    <div>Ambil: {row.pengambilan}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginBottom: 2 }}>Stok akhir</div>
                    <input
                      type="number"
                      className="input-teks"
                      value={row.stok_akhir}
                      onChange={e => updateRow(row.item_id, 'stok_akhir', e.target.value)}
                      placeholder="0"
                      min="0"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: 2, minWidth: 120 }}>
                    <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginBottom: 2 }}>Catatan</div>
                    <input
                      type="text"
                      className="input-teks"
                      value={row.catatan}
                      onChange={e => updateRow(row.item_id, 'catatan', e.target.value)}
                      placeholder="opsional"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ fontSize: 11, color: 'var(--warna-abu)' }}>Pemakaian</div>
                    <div style={{ fontFamily: 'var(--font-angka)', fontWeight: 700 }}>{pemakaian}</div>
                    {hpp !== null && (
                      <div style={{ fontSize: 12, color: 'var(--warna-karamel)' }}>{formatRupiah(hpp)}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ borderTop: '2px solid var(--warna-garis)', paddingTop: 12, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>Total HPP</span>
            <span style={{ fontFamily: 'var(--font-angka)', fontWeight: 700, fontSize: 16, color: 'var(--warna-karamel)' }}>
              {formatRupiah(totalHpp)}
            </span>
          </div>

          <button
            className="tombol tombol--primer"
            style={{ marginTop: 16 }}
            onClick={handleSimpan}
            disabled={loadingSimpan}
          >
            {loadingSimpan ? <span className="spinner" /> : modeEdit ? 'Simpan Perubahan' : 'Simpan Opname'}
          </button>
        </div>
      )}
    </div>
  );
}
