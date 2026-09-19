import { useState, useEffect } from 'react';
import { api, authStorage, ApiError } from '../api/client';

function hariIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function awalBulanIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function OpnameOutletCrew() {
  const deviceInfo = authStorage.ambilDeviceInfo();
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
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [modeEdit, setModeEdit] = useState(false);
  const [opnameIdEdit, setOpnameIdEdit] = useState(null);

  useEffect(() => {
    api.get('/master/outlets').then(semua => {
      const filtered = semua.filter(o => o.gudang_asal_id === deviceInfo?.gudangId);
      setOutlets(filtered);
      if (filtered.length === 1) setOutletId(String(filtered[0].id));
    }).catch(() => {});
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
    setError(''); setSukses(''); setLoadingPreview(true);
    setModeEdit(false); setOpnameIdEdit(null);
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
    if (opname.status !== 'ditolak') return;
    setError(''); setSukses('');
    setModeEdit(true); setOpnameIdEdit(opname.id);
    setTanggalOpname(opname.tanggal_opname?.slice(0, 10));
    setPeriodeDari(opname.periode_dari?.slice(0, 10));
    setSampaiTanggal(opname.periode_sampai?.slice(0, 10));
    try {
      const data = await api.get(`/opname-outlet/${opname.id}/detail`);
      setRows(data.items.map(item => ({
        item_id: item.item_id,
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
        await api.put(`/opname-outlet/${opnameIdEdit}/resubmit`, {});
        setSukses('Opname berhasil direvisi dan dikirim ulang untuk approval.');
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
        setSukses('Opname berhasil dikirim, menunggu approval admin.');
      }
      const d = await api.get(`/opname-outlet/riwayat/${outletId}`);
      setRiwayat(d || []);
      setRows([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan opname.');
    } finally {
      setLoadingSimpan(false);
    }
  }

  const statusLabel = (op) => {
    if (op.status === 'approved') return { text: 'Disetujui', bg: 'var(--warna-karamel)', color: 'white' };
    if (op.status === 'ditolak') return { text: 'Ditolak', bg: '#fee2e2', color: '#b91c1c' };
    return { text: 'Menunggu Approval', bg: 'var(--warna-krim-redup)', color: 'var(--warna-arang)' };
  };

  return (
    <div className="konten">
      <div className="riwayat-filter" style={{ flexWrap: 'wrap', gap: 8 }}>
        {outlets.length > 1 && (
          <select className="input-teks" value={outletId}
            onChange={e => { setOutletId(e.target.value); setRows([]); }}
            style={{ width: 'auto', padding: '0 12px' }}>
            <option value="">Pilih outlet</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.nama}</option>)}
          </select>
        )}
        {outlets.length === 1 && (
          <div style={{ fontWeight: 600, alignSelf: 'center' }}>{outlets[0].nama}</div>
        )}
        <input type="date" className="input-teks" value={periodeDari}
          onChange={e => setPeriodeDari(e.target.value)} style={{ width: 'auto' }} />
        <span style={{ alignSelf: 'center', color: 'var(--warna-abu)', fontSize: 13 }}>s/d</span>
        <input type="date" className="input-teks" value={periodeSampai}
          onChange={e => setSampaiTanggal(e.target.value)} style={{ width: 'auto' }} />
        <input type="date" className="input-teks" value={tanggalOpname}
          onChange={e => setTanggalOpname(e.target.value)} style={{ width: 'auto' }}
          title="Tanggal opname" />
        <button className="tombol tombol--primer"
          style={{ width: 'auto', padding: '0 20px' }}
          onClick={muatFormBaru}
          disabled={loadingPreview || !outletId}>
          {loadingPreview ? <span className="spinner" /> : 'Buat Opname'}
        </button>
      </div>

      {error && <div className="pesan-error" style={{ marginTop: 8 }}>{error}</div>}
      {sukses && <div className="pesan-sukses" style={{ marginTop: 8 }}>{sukses}</div>}

      {outletId && (
        <div style={{ marginTop: 16 }}>
          <p className="label">Riwayat Opname</p>
          {loadingRiwayat && <p style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Memuat...</p>}
          {!loadingRiwayat && riwayat.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Belum ada opname.</p>
          )}
          {riwayat.map(op => {
            const badge = statusLabel(op);
            return (
              <div key={op.id} className="kartu" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{op.tanggal_opname?.slice(0, 10)}</div>
                    <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>
                      {op.periode_dari?.slice(0, 10)} s/d {op.periode_sampai?.slice(0, 10)}
                    </div>
                    <div style={{
                      display: 'inline-block', fontSize: 11, padding: '2px 8px',
                      borderRadius: 10, marginTop: 4,
                      background: badge.bg, color: badge.color,
                    }}>
                      {badge.text}
                    </div>
                    {op.status === 'ditolak' && op.catatan_approval && (
                      <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                        Alasan: {op.catatan_approval}
                      </div>
                    )}
                  </div>
                  {op.status === 'ditolak' && (
                    <button className="tombol tombol--sekunder"
                      style={{ width: 'auto', padding: '4px 12px', fontSize: 12 }}
                      onClick={() => muatFormEdit(op)}>
                      Revisi
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p className="label">
            {modeEdit ? 'Revisi Opname' : 'Opname Baru'} — {tanggalOpname}
          </p>
          {rows.map(row => {
            const pemakaian = hitungPemakaian(row);
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginBottom: 2 }}>Stok akhir</div>
                    <input type="number" className="input-teks"
                      value={row.stok_akhir}
                      onChange={e => updateRow(row.item_id, 'stok_akhir', e.target.value)}
                      placeholder="0" min="0" style={{ width: '100%' }} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginBottom: 2 }}>Catatan</div>
                    <input type="text" className="input-teks"
                      value={row.catatan}
                      onChange={e => updateRow(row.item_id, 'catatan', e.target.value)}
                      placeholder="opsional" style={{ width: '100%' }} />
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 60 }}>
                    <div style={{ fontSize: 11, color: 'var(--warna-abu)' }}>Pakai</div>
                    <div style={{ fontFamily: 'var(--font-angka)', fontWeight: 700 }}>{pemakaian}</div>
                  </div>
                </div>
              </div>
            );
          })}
          <button className="tombol tombol--primer" style={{ marginTop: 16 }}
            onClick={handleSimpan} disabled={loadingSimpan}>
            {loadingSimpan ? <span className="spinner" />
              : modeEdit ? 'Kirim Ulang untuk Approval' : 'Kirim untuk Approval'}
          </button>
        </div>
      )}
    </div>
  );
}
