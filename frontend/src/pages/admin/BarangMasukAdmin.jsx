import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import UploadFoto from '../../components/UploadFoto';

export default function BarangMasukAdmin() {
  const [items, setItems] = useState([]);
  const [gudangs, setGudangs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sukses, setSukses] = useState(null);

  const [form, setForm] = useState({ itemId: '', gudangId: '', jumlah: '', satuan: '', hargaBeli: '', sumber: '', fotoBuktiUrl: '' });

  useEffect(() => {
    Promise.all([api.get('/master/items'), api.get('/master/gudangs')])
      .then(([i, g]) => { setItems(i); setGudangs(g); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'));
  }, []);

  function pilihItem(itemId) {
    const item = items.find((i) => String(i.id) === itemId);
    setForm((f) => ({ ...f, itemId, satuan: item?.satuan || '' }));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSukses(null);
    setLoading(true);
    try {
      await api.post('/barang-masuk/admin', {
        itemId: Number(form.itemId),
        gudangId: Number(form.gudangId),
        jumlah: Number(form.jumlah),
        satuan: form.satuan,
        hargaBeli: form.hargaBeli ? Number(form.hargaBeli) : undefined,
        sumber: form.sumber || undefined,
        fotoBuktiUrl: form.fotoBuktiUrl,
      });
      setSukses('Barang masuk tersimpan & langsung terverifikasi. Stok sudah bertambah.');
      setForm({ itemId: '', gudangId: '', jumlah: '', satuan: '', hargaBeli: '', sumber: '', fotoBuktiUrl: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal simpan.');
    } finally {
      setLoading(false);
    }
  }

  const bisaKirim = form.itemId && form.gudangId && Number(form.jumlah) > 0 && form.satuan.trim() && form.fotoBuktiUrl;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}
      {sukses && <div className="pesan-sukses">{sukses}</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label className="label">Gudang tujuan</label>
          <select className="input-teks" value={form.gudangId} onChange={(e) => setForm((f) => ({ ...f, gudangId: e.target.value }))}>
            <option value="">Pilih gudang</option>
            {gudangs.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
          </select>
        </div>

        <div className="field">
          <label className="label">Item</label>
          <select className="input-teks" value={form.itemId} onChange={(e) => pilihItem(e.target.value)}>
            <option value="">Pilih item</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.nama}</option>)}
          </select>
        </div>

        <div className="field">
          <label className="label">Jumlah</label>
          <input type="number" className="input-teks" value={form.jumlah} onChange={(e) => setForm((f) => ({ ...f, jumlah: e.target.value }))} />
        </div>

        <div className="field">
          <label className="label">Satuan</label>
          <input className="input-teks" value={form.satuan} onChange={(e) => setForm((f) => ({ ...f, satuan: e.target.value }))} />
        </div>

        <div className="field">
          <label className="label">Harga beli (opsional, buat HPP)</label>
          <input type="number" className="input-teks" value={form.hargaBeli} onChange={(e) => setForm((f) => ({ ...f, hargaBeli: e.target.value }))} />
        </div>

        <div className="field">
          <label className="label">Dari supplier (opsional)</label>
          <input className="input-teks" value={form.sumber} onChange={(e) => setForm((f) => ({ ...f, sumber: e.target.value }))} />
        </div>

        <UploadFoto value={form.fotoBuktiUrl} onChange={(url) => setForm((f) => ({ ...f, fotoBuktiUrl: url }))} label="Foto nota/bukti" />

        <button type="submit" className="tombol tombol--primer" disabled={!bisaKirim || loading} style={{ marginTop: 8 }}>
          {loading ? <span className="spinner" /> : 'Simpan (langsung terverifikasi)'}
        </button>
      </form>
    </div>
  );
}
