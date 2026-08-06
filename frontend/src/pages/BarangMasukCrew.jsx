import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authStorage, ApiError } from '../api/client';
import UploadFoto from '../components/UploadFoto';

export default function BarangMasukCrew() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sukses, setSukses] = useState(false);

  const [form, setForm] = useState({ itemId: '', jumlah: '', satuan: '', sumber: '', fotoBuktiUrl: '', namaCrewInput: '' });

  useEffect(() => {
    if (!authStorage.ambilDeviceToken()) {
      navigate('/setup-device');
      return;
    }
    api.get('/master/items').then(setItems).catch(() => {});
  }, [navigate]);

  function pilihItem(itemId) {
    const item = items.find((i) => String(i.id) === itemId);
    setForm((f) => ({ ...f, itemId, satuan: item?.satuan || '' }));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/barang-masuk/crew', {
        itemId: Number(form.itemId),
        jumlah: Number(form.jumlah),
        satuan: form.satuan,
        sumber: form.sumber || undefined,
        fotoBuktiUrl: form.fotoBuktiUrl,
        namaCrewInput: form.namaCrewInput,
      });
      setSukses(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim. Cek koneksi internet.');
    } finally {
      setLoading(false);
    }
  }

  function mulaiLagi() {
    setForm({ itemId: '', jumlah: '', satuan: '', sumber: '', fotoBuktiUrl: '', namaCrewInput: '' });
    setSukses(false);
  }

  const bisaKirim =
    form.itemId && Number(form.jumlah) > 0 && form.satuan.trim() && form.fotoBuktiUrl && form.namaCrewInput.trim();

  if (sukses) {
    return (
      <div className="konten" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 48 }}>✓</div>
        <h2 style={{ margin: '8px 0' }}>Berhasil dikirim</h2>
        <p style={{ color: 'var(--warna-abu)' }}>
          Menunggu diverifikasi Admin sebelum stok bertambah — ini normal, bukan error.
        </p>
        <button className="tombol tombol--primer" style={{ marginTop: 20 }} onClick={mulaiLagi}>
          Input lagi
        </button>
      </div>
    );
  }

  return (
    <div className="konten">
      <p style={{ color: 'var(--warna-abu)', marginTop: 0, fontSize: 13 }}>
        Buat barang yang dikirim supplier LANGSUNG ke gudang ini (bukan lewat Gudang Produksi). Setelah dikirim, Admin
        perlu verifikasi dulu sebelum stok resmi bertambah.
      </p>

      {error && <div className="pesan-error">{error}</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label className="label">Nama kamu</label>
          <input
            className="input-teks"
            placeholder="Ketik nama kamu"
            value={form.namaCrewInput}
            onChange={(e) => setForm((f) => ({ ...f, namaCrewInput: e.target.value }))}
          />
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
          <input
            type="number"
            className="input-teks"
            value={form.jumlah}
            onChange={(e) => setForm((f) => ({ ...f, jumlah: e.target.value }))}
          />
        </div>

        <div className="field">
          <label className="label">Satuan</label>
          <input
            className="input-teks"
            value={form.satuan}
            onChange={(e) => setForm((f) => ({ ...f, satuan: e.target.value }))}
          />
        </div>

        <div className="field">
          <label className="label">Dari supplier (opsional)</label>
          <input
            className="input-teks"
            placeholder="mis. Toko Sumber Rejeki"
            value={form.sumber}
            onChange={(e) => setForm((f) => ({ ...f, sumber: e.target.value }))}
          />
        </div>

        <UploadFoto value={form.fotoBuktiUrl} onChange={(url) => setForm((f) => ({ ...f, fotoBuktiUrl: url }))} label="Foto nota/bukti" />

        <button type="submit" className="tombol tombol--primer" disabled={!bisaKirim || loading} style={{ marginTop: 8 }}>
          {loading ? <span className="spinner" /> : 'Kirim, tunggu verifikasi Admin'}
        </button>
      </form>
    </div>
  );
}
