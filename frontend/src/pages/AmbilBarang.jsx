import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authStorage, ApiError } from '../api/client';
import QtyStepper from '../components/QtyStepper';

function formatTanggal(tanggalStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const kemarin = new Date(today);
  kemarin.setDate(kemarin.getDate() - 1);
  const tgl = new Date(tanggalStr + 'T00:00:00');
  if (tgl.getTime() === today.getTime()) return 'Hari ini';
  if (tgl.getTime() === kemarin.getTime()) return 'Kemarin';
  return tgl.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function AmbilBarang() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('ambil'); // 'ambil' | 'riwayat'

  const [tahap, setTahap] = useState('pilih'); // 'pilih' | 'review' | 'selesai'
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [cari, setCari] = useState('');
  const [cart, setCart] = useState({}); // { [itemId]: qty }
  const [namaCrew, setNamaCrew] = useState(() => authStorage.ambilDeviceInfo()?.nama || '');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [outletTujuanId, setOutletTujuanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sesiId, setSesiId] = useState(null);

  const [riwayat, setRiwayat] = useState([]);
  const [riwayatLoading, setRiwayatLoading] = useState(false);
  const [riwayatError, setRiwayatError] = useState(null);
  const [riwayatSudahDimuat, setRiwayatSudahDimuat] = useState(false);

  const gudangId = authStorage.ambilDeviceInfo()?.gudangId;

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

  const muatRiwayat = useCallback(async () => {
    if (!gudangId) return;
    setRiwayatLoading(true);
    setRiwayatError(null);
    try {
      const data = await api.get(`/sesi-pengambilan-crew/gudang/${gudangId}`);
      setRiwayat(data);
      setRiwayatSudahDimuat(true);
    } catch (err) {
      setRiwayatError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat.');
    } finally {
      setRiwayatLoading(false);
    }
  }, [gudangId]);

  useEffect(() => {
    if (tab === 'riwayat' && !riwayatSudahDimuat) {
      muatRiwayat();
    }
  }, [tab, riwayatSudahDimuat, muatRiwayat]);

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
      }, { idempotencyKey });
      setSesiId(hasil.sesiId);
      setTahap('selesai');
      setRiwayatSudahDimuat(false); // paksa reload riwayat setelah kirim berhasil
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
    setIdempotencyKey(crypto.randomUUID());
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
              placeholder="Nama dari sesi QR"
              value={namaCrew}
              readOnly
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
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--warna-garis)' }}>
        <TabBtn label="Ambil Barang" aktif={tab === 'ambil'} onClick={() => setTab('ambil')} />
        <TabBtn label="Riwayat" aktif={tab === 'riwayat'} onClick={() => setTab('riwayat')} />
      </div>

      {tab === 'ambil' ? (
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
      ) : (
        <TabRiwayat
          riwayat={riwayat}
          loading={riwayatLoading}
          error={riwayatError}
          onRetry={muatRiwayat}
        />
      )}
    </>
  );
}

function TabBtn({ label, aktif, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '14px 0',
        border: 'none',
        borderBottom: aktif ? '2px solid var(--warna-arang)' : '2px solid transparent',
        marginBottom: -2,
        background: 'none',
        fontWeight: aktif ? 700 : 500,
        color: aktif ? 'var(--warna-arang)' : 'var(--warna-abu)',
        cursor: 'pointer',
        fontSize: 14,
      }}
    >
      {label}
    </button>
  );
}

function TabRiwayat({ riwayat, loading, error, onRetry }) {
  if (loading) {
    return (
      <div style={{ padding: '16px 16px 0' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            background: 'var(--warna-garis)',
            borderRadius: 10,
            height: 90,
            marginBottom: 10,
            opacity: 0.4,
          }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--warna-bahaya)', fontSize: 14, marginBottom: 12 }}>{error}</p>
        <button className="tombol tombol--sekunder" onClick={onRetry} style={{ fontSize: 13 }}>
          Coba lagi
        </button>
      </div>
    );
  }

  if (riwayat.length === 0) {
    return (
      <p style={{ textAlign: 'center', color: 'var(--warna-abu)', marginTop: 48, fontSize: 14, padding: '0 24px' }}>
        Belum ada pengambilan dalam 30 hari ini.
      </p>
    );
  }

  return (
    <div style={{ padding: '12px 16px 100px' }}>
      {riwayat.map((sesi) => (
        <KartuRiwayat key={sesi.id} sesi={sesi} />
      ))}
    </div>
  );
}

function KartuRiwayat({ sesi }) {
  const dibatalkan = sesi.label_status === 'Dikoreksi';
  const items = Array.isArray(sesi.items) ? sesi.items : [];
  const pembatal = items.find((i) => i.dikoreksi_oleh)?.dikoreksi_oleh || 'admin';
  // Untuk sesi normal: list korektor koreksi cepat (jika ada)
  const korektorList = dibatalkan ? [] : [...new Set(items.filter((i) => i.dikoreksi_oleh).map((i) => i.dikoreksi_oleh))];

  return (
    <div style={{
      background: 'white',
      border: `1.5px solid ${dibatalkan ? 'var(--warna-bahaya)' : 'var(--warna-garis)'}`,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 10,
    }}>
      {/* Banner pembatalan */}
      {dibatalkan && (
        <div style={{
          background: '#FBEAE9',
          color: 'var(--warna-bahaya)',
          fontSize: 11,
          fontWeight: 700,
          padding: '6px 14px',
          borderBottom: '1px solid #F5C5C2',
        }}>
          Sesi ini dibatalkan — stok dikembalikan ke gudang
        </div>
      )}

      <div style={{ padding: '12px 14px' }}>
        {/* Header */}
        <div style={{ marginBottom: dibatalkan ? 2 : 6 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: dibatalkan ? 'var(--warna-abu)' : 'var(--warna-arang)' }}>
            {sesi.nama_crew}
          </span>
          <span style={{ color: 'var(--warna-garis)', margin: '0 6px' }}>·</span>
          <span style={{ fontSize: 13, color: 'var(--warna-abu)' }}>{formatTanggal(sesi.tanggal)}</span>
        </div>

        {/* Sub-label dibatalkan oleh */}
        {dibatalkan && (
          <div style={{ fontSize: 11, color: 'var(--warna-bahaya)', marginBottom: 8 }}>
            Dibatalkan oleh {pembatal}
          </div>
        )}

        {/* Outlet */}
        <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginBottom: 8 }}>
          → {sesi.nama_outlet_tujuan}
        </div>

        {/* Item list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{
                color: 'var(--warna-abu)',
                textDecoration: dibatalkan ? 'line-through' : 'none',
              }}>
                {item.nama_item}
              </span>
              <span style={{
                color: dibatalkan ? 'var(--warna-abu)' : (item.dikoreksi_oleh ? 'var(--warna-bahaya)' : 'var(--warna-arang)'),
                textDecoration: dibatalkan ? 'line-through' : 'none',
                fontFamily: 'var(--font-angka)',
                flexShrink: 0,
                marginLeft: 8,
              }}>
                {Number(item.qty).toLocaleString('id-ID')} {item.satuan}
              </span>
            </div>
          ))}
        </div>

        {/* Korektor cepat (hanya untuk sesi normal) */}
        {korektorList.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginTop: 8 }}>
            Dikoreksi oleh {korektorList.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}
