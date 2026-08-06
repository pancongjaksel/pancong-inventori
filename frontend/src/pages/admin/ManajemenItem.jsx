import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

const KATEGORI_LIST = ['Bahan Adonan', 'Topping', 'Kemasan', 'Kebersihan'];

export default function ManajemenItem() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sukses, setSukses] = useState(null);
  const [editReorder, setEditReorder] = useState({}); // { [id]: value }
  const [prosesId, setProsesId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ kodeBarang: '', nama: '', kategori: '', satuan: '' });

  function muatUlang() {
    setLoading(true);
    api.get('/master/items?semua=true')
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }
  useEffect(muatUlang, []);

  async function simpanReorderPoint(id) {
    const nilai = editReorder[id];
    setProsesId(id);
    setError(null);
    try {
      await api.patch(`/master/items/${id}`, { reorderPoint: nilai === '' ? null : Number(nilai) });
      setSukses('Reorder point tersimpan.');
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal simpan.');
    } finally {
      setProsesId(null);
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
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Reorder point:</label>
            <input
              type="number"
              className="input-teks"
              style={{ width: 90, height: 36 }}
              placeholder={item.reorder_point ?? 'belum diset'}
              value={editReorder[item.id] ?? ''}
              onChange={(e) => setEditReorder((prev) => ({ ...prev, [item.id]: e.target.value }))}
            />
            <button
              className="tombol tombol--primer"
              style={{ width: 'auto', height: 36, padding: '0 12px', fontSize: 13 }}
              disabled={prosesId === item.id || editReorder[item.id] === undefined}
              onClick={() => simpanReorderPoint(item.id)}
            >
              Simpan
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
