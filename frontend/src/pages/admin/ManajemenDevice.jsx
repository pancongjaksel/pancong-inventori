import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

export default function ManajemenDevice() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prosesId, setProsesId] = useState(null);

  function muatUlang() {
    setLoading(true);
    api.get('/device-gudang')
      .then(setDevices)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }
  useEffect(muatUlang, []);

  async function toggle(device) {
    setProsesId(device.id);
    setError(null);
    try {
      await api.patch(`/device-gudang/${device.id}/${device.aktif ? 'cabut' : 'aktifkan'}`, {});
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal ubah status.');
    } finally {
      setProsesId(null);
    }
  }

  if (loading) return <p style={{ color: 'var(--warna-abu)' }}>Memuat...</p>;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}

      <p style={{ fontSize: 13, color: 'var(--warna-abu)', marginTop: 0 }}>
        Device baru ditambahkan lewat proses scan QR (halaman Setup Device), bukan dari sini. Di sini cuma buat cabut akses (mis. HP hilang) atau aktifkan lagi.
      </p>

      {devices.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--warna-abu)', marginTop: 40 }}>Belum ada device yang di-setup.</p>
      )}

      {devices.map((d) => (
        <div key={d.id} className="kartu" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, opacity: d.aktif ? 1 : 0.5 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{d.nama_device}</div>
            <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Gudang {d.nama_gudang}{!d.aktif && ' · Dicabut'}</div>
          </div>
          <button
            className={`tombol ${d.aktif ? 'tombol--bahaya' : 'tombol--sekunder'}`}
            style={{ width: 'auto', height: 36, padding: '0 14px', fontSize: 13 }}
            disabled={prosesId === d.id}
            onClick={() => toggle(d)}
          >
            {prosesId === d.id ? <span className="spinner" /> : d.aktif ? 'Cabut akses' : 'Aktifkan lagi'}
          </button>
        </div>
      ))}
    </div>
  );
}
