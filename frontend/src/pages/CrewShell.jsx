import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { api, authStorage } from '../api/client';
import BottomNav from '../components/layout/BottomNav';

export default function CrewShell() {
  const navigate = useNavigate();
  const deviceInfo = authStorage.ambilDeviceInfo();
  const [jumlahNotif, setJumlahNotif] = useState(0);

  useEffect(() => {
    let batal = false;
    async function cekNotif() {
      try {
        const data = await api.get('/notifikasi/jumlah-belum-dibaca');
        if (!batal) setJumlahNotif(data?.jumlah ?? 0);
      } catch {
        // diam-diam
      }
    }
    cekNotif();
    const timer = setInterval(cekNotif, 30000);
    return () => { batal = true; clearInterval(timer); };
  }, []);

  function handleLogout() {
    authStorage.hapusDevice();
    navigate('/setup-device');
  }

  return (
    <div className="crew-app">
      <header className="mobile-header">
        <div className="mobile-header__left">
          <div style={{ background: 'white', borderRadius: 8, padding: 3, display: 'flex', flexShrink: 0 }}>
            <img src="/logo.png" alt="Pancong Jaksel" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          </div>
          <div>
            <div className="mobile-header__title">Pancong Jaksel</div>
            <div className="mobile-header__subtitle">{deviceInfo?.namaGudang || 'Crew'}</div>
          </div>
        </div>
        <div className="mobile-header__action" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => navigate('/crew/notifikasi')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              position: 'relative', padding: '4px 8px',
              fontSize: 18, color: 'var(--warna-arang)',
            }}
          >
            🔔
            {jumlahNotif > 0 && (
              <span style={{
                position: 'absolute', top: 0, right: 0,
                background: 'var(--warna-bahaya)', color: 'white',
                fontSize: 9, fontWeight: 700, borderRadius: 8,
                padding: '1px 4px', minWidth: 14, textAlign: 'center',
              }}>
                {jumlahNotif > 9 ? '9+' : jumlahNotif}
              </span>
            )}
          </button>
          <button className="mobile-header__logout" onClick={handleLogout}>
            Keluar
          </button>
        </div>
      </header>

      <main className="crew-content">
        <Outlet />
      </main>

      <BottomNav role="crew" />
    </div>
  );
}
