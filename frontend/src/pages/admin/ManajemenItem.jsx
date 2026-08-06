import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

const KATEGORI_LIST = ['Bahan Adonan', 'Topping', 'Kemasan', 'Kebersihan'];

export default function ManajemenItem() {
  const [items, setItems] = useState([]);
  const [gudangList, setGudangList] = useState([]);
  const [reorderPoints, setReorderPoints] = useState([]); // [{item_id, gudang_id, reorder_point}]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sukses, setSukses] = useState(null);
  const [editReorder, setEditReorder] = useState({}); // { [`${itemId}-${gudangId}`]: value }
  const [prosesKey, setProsesKey] = useState(null);
  const [prosesId, setProsesId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ kodeBarang: '', nama: '', kategori: '', satuan: '' });

  function muatUlang() {
    setLoading(true);
    Promise.all([
      api.get('/master/items?semua=true'),
      api.get('/master/gudangs'),
      api.get('/master/reorder-points'),
    ])
      .then(([itemData, gudangData, reorderData]) => {
        setItems(itemData);
        setGudangList(gudangData);
        setReorderPoints(reorderData);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }
  useEffect(muatUlang, []);

  function cariReorderPoint(itemId, gudangId) {
    return reorderPoints.find((r) => r.item_id === itemId && r.gudang_id === gudangId)?.reorder_point ?? null;
  }

  async function simpanReorderPoint(itemId, gudangId) {
    const key = `${itemId}-${gudangId}`;
    const nilai = editReorder[key];
    setProsesKey(key);
    setError(null);
    try {
      await api.put('/master/reorder-points', {
        itemId,
        gudangId,
        reorderPoint: nilai === '' ? null : Number(nilai),
      });
      setSukses('Reorder point tersimpan.');
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal simpan.');
    } finally {
      setProsesKey(null);
    }
  }

  async function toggleAktif(item) {
    setProsesId(item.id);
    setError(null);
    try {
      await api.patch(`/master/items/${item.id}`, { statusAktif: !item.status_aktif });
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal ubah status.');
    } finally {
      setProsesId(null);
    }
  }

  async function tambahItem(e) {
    e.preventDefault();
    setProsesId('form');
    setError(null);
    try {
      await api.post('/master/items', form);
      setForm({ kodeBarang: '', nama: '', kategori: '', satuan: '' });
      setShowForm(false);
      setSukses('Item baru ditambahkan.');
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal tambah item.');
    } finally {
      setProsesId(null);
    }
  }

  if (loading) return <p style={{ color: 'var(--warna-abu)' }}>Memuat...</p>;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}
      {sukses && <div className="pesan-sukses">{sukses}</div>}

      <button className="tombol tombol--sekunder" style={{ marginBottom: 16 }} onClick={() => setShowForm((s) => !s)}>
        {showForm ? 'Batal' : '+ Tambah item baru'}
      </button>

      {showForm && (
        <form onSubmit={tambahItem} className="kartu" style={{ marginBottom: 20 }}>
          <div className="field">
            <label className="label">Kode barang</label>
            <input className="input-teks" placeholder="mis. BA-009" value={form.kodeBarang} onChange={(e) => setForm((f) => ({ ...f, kodeBarang: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label">Nama</label>
            <input className="input-teks" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label">Kategori</label>
            <select className="input-teks" value={form.kategori} onChange={(e) => setForm((f) => ({ ...f, kategori: e.target.value }))} required>
              <option value="">Pilih kategori</option>
              {KATEGORI_LIST.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Satuan</label>
            <input className="input-teks" placeholder="mis. Kg, Pack, Pcs" value={form.satuan} onChange={(e) => setForm((f) => ({ ...f, satuan: e.target.value }))} required />
          </div>
          <button type="submit" className="tombol tombol--primer" disabled={prosesId === 'form'}>
            {prosesId === 'form' ? <span className="spinner" /> : 'Simpan item'}
          </button>
        </form>
      )}

      {items.map((item) => (
        <div key={item.id} className="kartu" style={{ marginBottom: 10, opacity: item.status_aktif ? 1 : 0.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{item.nama}</div>
              <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>{item.kode_barang} · {item.kategori} · {item.satuan}</div>
            </div>
            <button
              className="tombol tombol--sekunder"
              style={{ width: 'auto', height: 32, padding: '0 10px', fontSize: 12 }}
              disabled={prosesId === item.id}
              onClick={() => toggleAktif(item)}
            >
              {item.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Reorder point per gudang:</label>
            {gudangList.map((g) => {
              const key = `${item.id}-${g.id}`;
              const nilaiTersimpan = cariReorderPoint(item.id, g.id);
              return (
                <div key={g.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--warna-abu)', width: 70, flexShrink: 0 }}>{g.nama}</span>
                  <input
                    type="number"
                    className="input-teks"
                    style={{ width: 90, height: 36 }}
                    placeholder={nilaiTersimpan ?? 'belum diset'}
                    value={editReorder[key] ?? ''}
                    onChange={(e) => setEditReorder((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                  <button
                    className="tombol tombol--primer"
                    style={{ width: 'auto', height: 36, padding: '0 12px', fontSize: 13 }}
                    disabled={prosesKey === key || editReorder[key] === undefined}
                    onClick={() => simpanReorderPoint(item.id, g.id)}
                  >
                    Simpan
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
