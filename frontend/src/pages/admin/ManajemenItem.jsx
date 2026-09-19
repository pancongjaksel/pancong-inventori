import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

const KATEGORI_LIST = ['Bahan Adonan', 'Topping', 'Kemasan', 'Kebersihan'];
const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v ?? 0);

export default function ManajemenItem() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sukses, setSukses] = useState(null);
  const [editReorder, setEditReorder] = useState({});
  const [editHarga, setEditHarga] = useState({});
  const [prosesId, setProsesId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ kodeBarang: '', nama: '', kategori: '', satuan: '', harga: 0 });

  function muatUlang() {
    setLoading(true);
    api.get('/master/items?semua=true')
      .then((list) => {
        setItems(list);
        // Pre-populate input dari nilai DB; jaga ketikan user yang belum disimpan
        setEditHarga((prev) => {
          const init = {};
          list.forEach((it) => { init[it.id] = String(it.harga ?? 0); });
          return { ...init, ...prev };
        });
        setEditReorder((prev) => {
          const init = {};
          list.forEach((it) => { init[it.id] = it.reorder_point != null ? String(it.reorder_point) : ''; });
          return { ...init, ...prev };
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }
  useEffect(muatUlang, []);

  // ── Per-item saves — update state lokal, TIDAK muatUlang (scroll tetap) ──

  async function simpanReorderPoint(id) {
    const nilai = editReorder[id];
    if (nilai === undefined) return;
    setProsesId(`rp-${id}`);
    setError(null);
    try {
      const saved = nilai === '' ? null : Number(nilai);
      await api.patch(`/master/items/${id}`, { reorderPoint: saved });
      setSukses('Reorder point tersimpan.');
      setItems((prev) => prev.map((it) => it.id === id ? { ...it, reorder_point: saved } : it));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal simpan reorder point.');
    } finally {
      setProsesId(null);
    }
  }

  async function simpanHarga(id) {
    const nilai = editHarga[id];
    if (nilai === undefined) return;
    setProsesId(`harga-${id}`);
    setError(null);
    try {
      const saved = nilai === '' ? 0 : parseInt(nilai, 10);
      await api.patch(`/master/items/${id}`, { harga: saved });
      setSukses('Harga tersimpan.');
      setItems((prev) => prev.map((it) => it.id === id ? { ...it, harga: saved } : it));
      setEditHarga((prev) => ({ ...prev, [id]: String(saved) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal simpan harga.');
    } finally {
      setProsesId(null);
    }
  }

  // ── Batch saves ──

  async function simpanSemua() {
    setProsesId('batch-semua');
    setError(null);
    try {
      await simpanSemuaHarga();
      await simpanSemuaReorder();
      setSukses('Harga dan reorder point tersimpan.');
    } catch {
      // error sudah di-set oleh masing-masing fungsi
    } finally {
      setProsesId(null);
    }
  }

  async function simpanSemuaHarga() {
    const payload = items
      .map((it) => ({ id: it.id, harga: editHarga[it.id] === '' ? 0 : parseInt(editHarga[it.id] ?? '0', 10) }))
      .filter((it) => Number.isFinite(it.harga) && it.harga >= 0);
    if (payload.length === 0) return;
    setProsesId('batch-harga');
    setError(null);
    try {
      await api.patch('/master/items/batch-harga', { items: payload });
      setSukses(`Harga ${payload.length} item tersimpan.`);
      const map = Object.fromEntries(payload.map((it) => [it.id, it.harga]));
      setItems((prev) => prev.map((it) => map[it.id] != null ? { ...it, harga: map[it.id] } : it));
      setEditHarga((prev) => {
        const next = { ...prev };
        payload.forEach((it) => { next[it.id] = String(it.harga); });
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal simpan semua harga.');
    } finally {
      setProsesId(null);
    }
  }

  async function simpanSemuaReorder() {
    const payload = items
      .filter((it) => editReorder[it.id] !== '')
      .map((it) => ({ id: it.id, reorderPoint: Number(editReorder[it.id]) }))
      .filter((it) => Number.isFinite(it.reorderPoint) && it.reorderPoint >= 0);
    if (payload.length === 0) {
      setError('Belum ada reorder point yang diisi.');
      return;
    }
    setProsesId('batch-reorder');
    setError(null);
    try {
      await api.patch('/master/items/batch-reorder', { items: payload });
      setSukses(`Reorder point ${payload.length} item tersimpan.`);
      const map = Object.fromEntries(payload.map((it) => [it.id, it.reorderPoint]));
      setItems((prev) => prev.map((it) => map[it.id] != null ? { ...it, reorder_point: map[it.id] } : it));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal simpan semua reorder point.');
    } finally {
      setProsesId(null);
    }
  }

  // ── Aksi lain (muatUlang masih diperlukan karena struktur list berubah) ──

  async function toggleAktif(item) {
    setProsesId(item.id);
    setError(null);
    try {
      await api.patch(`/master/items/${item.id}`, { statusAktif: !item.status_aktif });
      setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, status_aktif: !item.status_aktif } : it));
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
      setForm({ kodeBarang: '', nama: '', kategori: '', satuan: '', harga: 0 });
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

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="tombol tombol--sekunder" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Batal' : '+ Tambah item baru'}
        </button>
        <button
          className="tombol tombol--primer"
          disabled={prosesId === 'batch-semua'}
          onClick={simpanSemua}
        >
          {prosesId === 'batch-semua' ? <span className="spinner" /> : 'Simpan Semua'}
        </button>
      </div>

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
          <div className="field">
            <label className="label">Harga (Rp)</label>
            <input type="number" min="0" className="input-teks" placeholder="0" value={form.harga} onChange={(e) => setForm((f) => ({ ...f, harga: Number(e.target.value) }))} />
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
              <div style={{ fontSize: 13, color: 'var(--warna-abu)', marginTop: 2 }}>
                {formatRupiah(item.harga)}
                {' · Reorder: '}
                {item.reorder_point != null ? item.reorder_point : <span style={{ fontStyle: 'italic' }}>belum diset</span>}
              </div>
            </div>
            <button
              className="tombol tombol--sekunder"
              style={{ width: 'auto', height: 32, padding: '0 10px', fontSize: 12, flexShrink: 0 }}
              disabled={prosesId === item.id}
              onClick={() => toggleAktif(item)}
            >
              {item.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: 'var(--warna-abu)', minWidth: 100 }}>Reorder point:</label>
            <input
              type="number"
              className="input-teks"
              style={{ width: 90, height: 36 }}
              placeholder="belum diset"
              value={editReorder[item.id] ?? ''}
              onChange={(e) => setEditReorder((prev) => ({ ...prev, [item.id]: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: 'var(--warna-abu)', minWidth: 100 }}>Harga (Rp):</label>
            <input
              type="number"
              min="0"
              className="input-teks"
              style={{ width: 120, height: 36 }}
              value={editHarga[item.id] ?? ''}
              onChange={(e) => setEditHarga((prev) => ({ ...prev, [item.id]: e.target.value }))}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
