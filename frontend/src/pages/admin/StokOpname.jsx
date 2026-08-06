import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

function periodeSekarang() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function StokOpname() {
  const [lokasiTipe, setLokasiTipe] = useState('gudang'); // 'gudang' | 'outlet'
  const [gudangs, setGudangs] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [items, setItems] = useState([]);
  const [lokasiId, setLokasiId] = useState('');
  const [periode, setPeriode] = useState(periodeSekarang());
  const [stokFisikPerItem, setStokFisikPerItem] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sukses, setSukses] = useState(null);
  const [prosesItemId, setProsesItemId] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/master/gudangs'), api.get('/master/outlets'), api.get('/master/items')])
      .then(([g, o, i]) => {
        setGudangs(g.filter((x) => x.tipe === 'serving')); // Produksi gak ada opname crew-facing, tapi tetap bisa opname manual — sesuaikan kalau perlu
        setOutlets(o);
        setItems(i);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }, []);

  async function submitSatuItem(itemId) {
    const stokFisik = stokFisikPerItem[itemId];
    if (stokFisik === undefined || stokFisik === '') return;

    setError(null);
    setSukses(null);
    setProsesItemId(itemId);
    try {
      const path = lokasiTipe === 'gudang' ? '/stok-opname/gudang' : '/stok-opname/outlet';
      const body =
        lokasiTipe === 'gudang'
          ? { gudangId: Number(lokasiId), itemId, stokFisik: Number(stokFisik), periode }
          : { outletId: Number(lokasiId), itemId, stokFisik: Number(stokFisik), periode };

      await api.post(path, body);
      setSukses(`Opname item tersimpan.`);
      setStokFisikPerItem((prev) => {
        const salinan = { ...prev };
        delete salinan[itemId];
        return salinan;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal simpan opname.');
    } finally {
      setProsesItemId(null);
    }
  }

  if (loading) return <p style={{ color: 'var(--warna-abu)' }}>Memuat...</p>;

  const daftarLokasi = lokasiTipe === 'gudang' ? gudangs : outlets;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}
      {sukses && <div className="pesan-sukses">{sukses}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className="tombol tombol--sekunder"
          style={{ width: 'auto', padding: '0 16px', background: lokasiTipe === 'gudang' ? 'var(--warna-krim-redup)' : undefined }}
          onClick={() => { setLokasiTipe('gudang'); setLokasiId(''); }}
        >
          Opname Gudang
        </button>
        <button
          className="tombol tombol--sekunder"
          style={{ width: 'auto', padding: '0 16px', background: lokasiTipe === 'outlet' ? 'var(--warna-krim-redup)' : undefined }}
          onClick={() => { setLokasiTipe('outlet'); setLokasiId(''); }}
        >
          Opname Outlet
        </button>
      </div>

      <div className="field">
        <label className="label">{lokasiTipe === 'gudang' ? 'Gudang' : 'Outlet'}</label>
        <select className="input-teks" value={lokasiId} onChange={(e) => setLokasiId(e.target.value)}>
          <option value="">Pilih {lokasiTipe === 'gudang' ? 'gudang' : 'outlet'}</option>
          {daftarLokasi.map((l) => <option key={l.id} value={l.id}>{l.nama}</option>)}
        </select>
      </div>

      <div className="field">
        <label className="label">Periode</label>
        <input type="month" className="input-teks" value={periode} onChange={(e) => setPeriode(e.target.value)} />
      </div>

      {lokasiTipe === 'outlet' && (
        <p style={{ fontSize: 13, color: 'var(--warna-abu)', marginTop: -8, marginBottom: 16 }}>
          Opname outlet kumulatif — stok awal periode ini otomatis diambil dari hasil opname bulan lalu (kalau ada).
        </p>
      )}

      {lokasiId && (
        <>
          <p className="label">Masukkan stok fisik per item</p>
          {items.map((item) => (
            <div key={item.id} className="kartu" style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{item.nama}</div>
                <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>{item.satuan}</div>
              </div>
              <input
                type="number"
                className="input-teks"
                style={{ width: 90 }}
                placeholder="0"
                value={stokFisikPerItem[item.id] ?? ''}
                onChange={(e) => setStokFisikPerItem((prev) => ({ ...prev, [item.id]: e.target.value }))}
              />
              <button
                className="tombol tombol--primer"
                style={{ width: 'auto', height: 44, padding: '0 16px' }}
                disabled={prosesItemId === item.id || stokFisikPerItem[item.id] === undefined || stokFisikPerItem[item.id] === ''}
                onClick={() => submitSatuItem(item.id)}
              >
                {prosesItemId === item.id ? <span className="spinner" /> : 'Simpan'}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
