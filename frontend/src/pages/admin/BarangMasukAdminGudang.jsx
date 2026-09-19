import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import UploadFoto from '../../components/UploadFoto';

export default function BarangMasukAdminGudang() {
  const [items, setItems] = useState([]);
  const [gudangs, setGudangs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sukses, setSukses] = useState(null);

  const [gudangId, setGudangId] = useState('');
  const [sumber, setSumber] = useState('');
  const [fotoBuktiUrl, setFotoBuktiUrl] = useState('');
  const [daftarItem, setDaftarItem] = useState([{ itemId: '', jumlah: '', satuan: '' }]);

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
    setDaftarItem((prev) => [...prev, { itemId: '', jumlah: '', satuan: '' }]);
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
      await api.post('/barang-masuk-nota/admin-gudang', {
        gudangId: Number(gudangId),
        sumber: sumber || undefined,
        fotoBuktiUrl,
        items: daftarItem.map((row) => ({
          itemId: Number(row.itemId),
          jumlah: Number(row.jumlah),
          satuan: row.satuan,
        })),
      });
      setSukses('Nota terkirim, menunggu diverifikasi Admin/Owner sebelum stok bertambah.');
      setGudangId('');
      setSumber('');
      setFotoBuktiUrl('');
      setDaftarItem([{ itemId: '', jumlah: '', satuan: '' }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal simpan.');
    } finally {
      setLoading(false);
    }
  }

  const semuaBarisValid = daftarItem.every((row) => row.itemId && Number(row.jumlah) > 0 && row.satuan.trim());
  const bisaKirim = gudangId && fotoBuktiUrl && semuaBarisValid && daftarItem.length > 0;

  const hintKirim = !gudangId
    ? 'Pilih gudang tujuan dulu'
    : !semuaBarisValid
    ? 'Lengkapi semua baris item (nama, jumlah, satuan)'
    : !fotoBuktiUrl
    ? 'Upload foto nota/bukti dulu'
    : null;

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
          <label className="label">Dari supplier (opsional)</label>
          <input className="input-teks" placeholder="Nama supplier / distributor" value={sumber} onChange={(e) => setSumber(e.target.value)} />
        </div>

        <div style={{ borderTop: '1px solid var(--warna-garis)', margin: '4px 0 16px' }} />
        <p className="label" style={{ marginBottom: 10 }}>Daftar Item ({daftarItem.length})</p>

        {daftarItem.map((row, idx) => (
          <div key={idx} className="kartu" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--warna-karamel)', color: 'white',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {idx + 1}
              </span>
              {daftarItem.length > 1 && (
                <button
                  type="button"
                  onClick={() => hapusBaris(idx)}
                  style={{ background: 'none', border: 'none', color: 'var(--warna-bahaya)', fontSize: 13, cursor: 'pointer', padding: '2px 4px' }}
                >
                  Hapus
                </button>
              )}
            </div>
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
          </div>
        ))}

        <button type="button" className="tombol tombol--sekunder" onClick={tambahBaris} style={{ marginBottom: 16 }}>
          + Tambah item lain
        </button>

        <div style={{ borderTop: '1px solid var(--warna-garis)', margin: '4px 0 16px' }} />

        <UploadFoto value={fotoBuktiUrl} onChange={setFotoBuktiUrl} label="Foto nota/bukti (1 foto untuk semua item di nota ini)" />

        <button type="submit" className="tombol tombol--primer" disabled={!bisaKirim || loading} style={{ marginTop: 8 }}>
          {loading ? <span className="spinner" /> : 'Kirim, tunggu verifikasi Admin'}
        </button>
        {hintKirim && !loading && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--warna-abu)', marginTop: 8, marginBottom: 0 }}>
            {hintKirim}
          </p>
        )}
      </form>
    </div>
  );
}
