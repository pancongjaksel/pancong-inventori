import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authStorage, ApiError } from '../api/client';
import QtyStepper from '../components/QtyStepper';

export default function AmbilBarang() {
  const navigate = useNavigate();

  const [tahap, setTahap] = useState('pilih'); // 'pilih' | 'review' | 'selesai'
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [cari, setCari] = useState('');
  const [cart, setCart] = useState({}); // { [itemId]: qty }
  const [namaCrew, setNamaCrew] = useState('');
  const [outletTujuanId, setOutletTujuanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sesiId, setSesiId] = useState(null);

  useEffect(() => {
    if (!authStorage.ambilDeviceToken()) {
      navigate('/setup-device');
      return;
    }
    Promise.all([
      api.get('/master/items?konteks=crew'),
      api.get('/master/outlets'),
    ])
      .then(([itemData, outletData]) => {
        setItems(itemData);
        setOutlets(outletData);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'));
  }, [navigate]);

  const itemTersaring = useMemo(() => {
    if (!cari.trim()) return items;
    const kunci = cari.trim().toLowerCase();
    return items.filter((i) => i.nama.toLowerCase().includes(kunci));
  }, [items, cari]);

  const jumlahItemDiCart = Object.values(cart).filter((qty) => qty > 0).length;

  function ubahQty(itemId, qty) {
    setCart((prev) => ({ ...prev, [itemId]: qty }));
  }

  function lanjutKeReview() {
    if (jumlahItemDiCart === 0) return;
    setTahap('review');
  }

  const daftarCartUntukReview = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const item = items.find((i) => String(i.id) === itemId);
          return { itemId: Number(itemId), nama: item?.nama, satuan: item?.satuan, qty };
        }),
    [cart, items]
  );

  async function kirimSesi() {
    setError(null);
    setLoading(true);
    try {
      const hasil = await api.post('/sesi-pengambilan-crew', {
        namaCrew,
        outletTujuanId: Number(outletTujuanId),
        daftarItem: daftarCartUntukReview.map(({ itemId, qty }) => ({ itemId, qty })),
      });
      setSesiId(hasil.sesiId);
      setTahap('selesai');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim. Cek koneksi internet.');
    } finally {
      setLoading(false);
    }
  }

  function mulaiLagi() {
    setCart({});
    setNamaCrew('');
    setOutletTujuanId('');
    setSesiId(null);
    setError(null);
    setTahap('pilih');
  }

  const bisaKirim = namaCrew.trim().length > 0 && outletTujuanId !== '' && jumlahItemDiCart > 0;

  // ---------- Tahap: SELESAI ----------
  if (tahap === 'selesai') {
    return (
      <>
        <div className="konten" style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: 48 }}>✓</div>
          <h2 style={{ margin: '8px 0' }}>Berhasil dikirim</h2>
          <p style={{ color: 'var(--warna-abu)' }}>Sesi #{sesiId} — {daftarCartUntukReview.length} item tercatat.</p>
        </div>
        <div className="tombol-utama-bawah">
          <button className="tombol tombol--primer" onClick={mulaiLagi}>Ambil lagi</button>
        </div>
      </>
    );
  }

  // ---------- Tahap: REVIEW ----------
  if (tahap === 'review') {
    return (
      <>
        <div className="konten">
          {error && <div className="pesan-error">{error}</div>}

          <div className="field">
            <label className="label" htmlFor="namaCrew">Nama kamu</label>
            <input
              id="namaCrew"
              className="input-teks"
              placeholder="Ketik nama kamu"
              value={namaCrew}
              onChange={(e) => setNamaCrew(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="outletTujuan">Outlet tujuan</label>
            <select
              id="outletTujuan"
              className="input-teks"
              value={outletTujuanId}
              onChange={(e) => setOutletTujuanId(e.target.value)}
            >
              <option value="">Pilih outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.nama}</option>
              ))}
            </select>
          </div>

          <p className="label">Barang ({daftarCartUntukReview.length})</p>
          {daftarCartUntukReview.map((row) => (
            <div key={row.itemId} className="kartu" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{row.nama}</div>
                <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>{row.qty} {row.satuan}</div>
              </div>
              <QtyStepper value={row.qty} onChange={(qty) => ubahQty(row.itemId, qty)} />
            </div>
          ))}
        </div>
        <div className="tombol-utama-bawah">
          <button className="tombol tombol--sekunder" style={{ marginBottom: 10 }} onClick={() => setTahap('pilih')}>
            Tambah barang lain
          </button>
          <button className="tombol tombol--primer" onClick={kirimSesi} disabled={!bisaKirim || loading}>
            {loading ? <span className="spinner" /> : 'Kirim'}
          </button>
        </div>
      </>
    );
  }

  // ---------- Tahap: PILIH ITEM (default) ----------
  return (
    <>
      <div className="konten">
        {error && <div className="pesan-error">{error}</div>}

        <input
          className="input-teks"
          placeholder="Cari barang..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        {itemTersaring.map((item) => (
          <div key={item.id} className="kartu" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{item.nama}</div>
              <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>{item.satuan}</div>
            </div>
            <QtyStepper value={cart[item.id] || 0} onChange={(qty) => ubahQty(item.id, qty)} />
          </div>
        ))}

        {itemTersaring.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--warna-abu)', marginTop: 40 }}>
            Gak ada barang dengan nama itu.
          </p>
        )}
      </div>

      {jumlahItemDiCart > 0 && (
        <div className="tombol-utama-bawah">
          <button className="tombol tombol--primer" onClick={lanjutKeReview}>
            Lanjut ({jumlahItemDiCart} barang)
          </button>
        </div>
      )}
    </>
  );
}
