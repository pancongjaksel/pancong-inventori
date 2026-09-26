import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authStorage, ApiError } from '../api/client';
import UploadFoto from '../components/UploadFoto';
import VendorField from '../components/VendorField';

export default function BarangMasukCrew() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sukses, setSukses] = useState(false);

  const [sumber, setSumber] = useState('');
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [vendorBaru, setVendorBaru] = useState('');
  const [fotoBuktiUrl, setFotoBuktiUrl] = useState('');
  const [daftarItem, setDaftarItem] = useState([{ itemId: '', jumlah: '', satuan: '' }]);

  useEffect(() => {
    if (!authStorage.ambilDeviceToken()) {
      navigate('/setup-device');
      return;
    }
    Promise.all([api.get('/master/items'), api.get('/master/vendors')]).then(([i, v]) => { setItems(i); setVendors(v); }).catch(() => {});
  }, [navigate]);

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
    setLoading(true);
    try {
      await api.post('/barang-masuk-nota/crew', {
        vendorId: vendorId === '__baru__' ? undefined : Number(vendorId),
        vendorBaru: vendorId === '__baru__' ? vendorBaru : undefined,
        fotoBuktiUrl,
        items: daftarItem.map((row) => ({
          itemId: Number(row.itemId),
          jumlah: Number(row.jumlah),
          satuan: row.satuan,
        })),
      });
      setSukses(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim. Cek koneksi internet.');
    } finally {
      setLoading(false);
    }
  }

  function mulaiLagi() {
    setSumber('');
    setVendorId(''); setVendorBaru('');
    setFotoBuktiUrl('');
    setDaftarItem([{ itemId: '', jumlah: '', satuan: '' }]);
    setSukses(false);
  }

  const semuaBarisValid = daftarItem.every((row) => row.itemId && Number(row.jumlah) > 0 && row.satuan.trim());
  const bisaKirim = fotoBuktiUrl && semuaBarisValid && daftarItem.length > 0 && vendorId && (vendorId !== '__baru__' || vendorBaru.trim());

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
        Buat barang yang dikirim supplier LANGSUNG ke gudang ini (bukan lewat Gudang Produksi). Bisa input beberapa item sekaligus kalau datang dalam 1 nota. Setelah dikirim, Admin perlu verifikasi dulu sebelum stok resmi bertambah.
      </p>

      {error && <div className="pesan-error">{error}</div>}

      <form onSubmit={submit}>
        <VendorField vendors={vendors} vendorId={vendorId} setVendorId={setVendorId} vendorBaru={vendorBaru} setVendorBaru={setVendorBaru} />

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
                <input
                  type="number"
                  className="input-teks"
                  value={row.jumlah}
                  onChange={(e) => ubahBaris(idx, { jumlah: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="label">Satuan</label>
                <input
                  className="input-teks"
                  value={row.satuan}
                  onChange={(e) => ubahBaris(idx, { satuan: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}

        <button type="button" className="tombol tombol--sekunder" onClick={tambahBaris} style={{ marginBottom: 16 }}>
          + Tambah item lain
        </button>

        <UploadFoto value={fotoBuktiUrl} onChange={setFotoBuktiUrl} label="Foto nota/bukti (1 foto untuk semua item)" />

        <button type="submit" className="tombol tombol--primer" disabled={!bisaKirim || loading} style={{ marginTop: 8 }}>
          {loading ? <span className="spinner" /> : 'Kirim, tunggu verifikasi Admin'}
        </button>
      </form>
    </div>
  );
}
