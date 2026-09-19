import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import UploadFoto from '../../components/UploadFoto';

export default function BarangMasukAdmin() {
  const [items, setItems] = useState([]);
  const [gudangs, setGudangs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sukses, setSukses] = useState(null);

  const [gudangId, setGudangId] = useState('');
  const [sumber, setSumber] = useState('');
  const [fotoBuktiUrl, setFotoBuktiUrl] = useState('');
  const [daftarItem, setDaftarItem] = useState([{ itemId: '', jumlah: '', satuan: '', hargaBeli: '' }]);

  useEffect(() => {
    Promise.all([api.get('/master/items'), api.get('/master/gudangs')])
      .then(([i, g]) => { setItems(i); setGudangs(g); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'));
  }, []);

  function ubahBaris(idx, patch) {
    setDaftarItem((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function pilihItemBaris(idx, itemId) {
    const item = items.find((i) => String(i.id) === itemId);
    ubahBaris(idx, { itemId, satuan: item?.satuan || '' });
  }

  function tambahBaris() {
    setDaftarItem((prev) => [...prev, { itemId: '', jumlah: '', satuan: '', hargaBeli: '' }]);
  }

  function hapusBaris(idx) {
    setDaftarItem((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSukses(null);
    setLoading(true);
    try {
      await api.post('/barang-masuk-nota/admin', {
        gudangId: Number(gudangId),
        sumber: sumber || undefined,
        fotoBuktiUrl,
        items: daftarItem.map((row) => ({
          itemId: Number(row.itemId),
          jumlah: Number(row.jumlah),
          satuan: row.satuan,
          hargaBeli: row.hargaBeli ? Number(row.hargaBeli) : undefined,
        })),
      });
      setSukses('Nota tersimpan & langsung terverifikasi. Stok semua item sudah bertambah.');
      setGudangId('');
      setSumber('');
      setFotoBuktiUrl('');
      setDaftarItem([{ itemId: '', jumlah: '', satuan: '', hargaBeli: '' }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal simpan.');
    } finally {
      setLoading(false);
    }
  }

  const semuaBarisValid = daftarItem.every((row) => row.itemId && Number(row.jumlah) > 0 && row.satuan.trim());
  const bisaKirim = gudangId && fotoBuktiUrl && semuaBarisValid && daftarItem.length > 0;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}
      {sukses && <div className="pesan-sukses">{sukses}</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label className="label">Gudang tujuan</label>
          <select className="input-teks" value={gudangId} onChange={(e) => setGudangId(e.target.value)}>
            <option value="">Pilih gudang</option>
            {gudangs.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
          </select>
        </div>

        <div className="field">
          <label className="label">Dari supplier (opsional, berlaku untuk semua item di nota ini)</label>
          <input className="input-teks" value={sumber} onChange={(e) => setSumber(e.target.value)} />
        </div>

        <p className="label" style={{ marginTop: 16, marginBottom: 8 }}>Daftar Item ({daftarItem.length})</p>

        {daftarItem.map((row, idx) => (
          <div key={idx} className="kartu" style={{ marginBottom: 10, position: 'relative' }}>
            {daftarItem.length > 1 && (
              <button
                type="button"
                onClick={() => hapusBaris(idx)}
                style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'var(--warna-bahaya, #b91c1c)', fontSize: 13, cursor: 'pointer' }}
              >
                Hapus
              </button>
            )}
            <div className="field">
              <label className="label">Item</label>
              <select className="input-teks" value={row.itemId} onChange={(e) => pilihItemBaris(idx, e.target.value)}>
                <option value="">Pilih item</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.nama}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="label">Jumlah</label>
                <input type="number" className="input-teks" value={row.jumlah} onChange={(e) => ubahBaris(idx, { jumlah: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="label">Satuan</label>
                <input className="input-teks" value={row.satuan} onChange={(e) => ubahBaris(idx, { satuan: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label className="label">Harga beli (opsional, buat HPP)</label>
              <input type="number" className="input-teks" value={row.hargaBeli} onChange={(e) => ubahBaris(idx, { hargaBeli: e.target.value })} />
            </div>
          </div>
        ))}

        <button type="button" className="tombol tombol--sekunder" onClick={tambahBaris} style={{ marginBottom: 16 }}>
          + Tambah item lain
        </button>

        <UploadFoto value={fotoBuktiUrl} onChange={setFotoBuktiUrl} label="Foto nota/bukti (1 foto untuk semua item di nota ini)" />

        <button type="submit" className="tombol tombol--primer" disabled={!bisaKirim || loading} style={{ marginTop: 8 }}>
          {loading ? <span className="spinner" /> : 'Simpan (langsung terverifikasi)'}
        </button>
      </form>
    </div>
  );
}
