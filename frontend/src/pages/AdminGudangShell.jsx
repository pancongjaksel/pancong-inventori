import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { api, authStorage } from '../api/client';
import BottomNav from '../components/layout/BottomNav';
import AdminGudangSidebar from '../components/layout/AdminGudangSidebar';
import NotifikasiPengambilan from '../components/NotifikasiPengambilan';
import ApprovalCenterCards from '../components/ApprovalCenterCards';

export default function AdminGudangShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const deviceInfo = authStorage.ambilDeviceInfo();

  useEffect(() => {
    if (!authStorage.ambilDeviceToken()) {
      navigate('/setup-device', { replace: true });
    }
  }, [navigate]);

  // Refetch notifikasi setiap navigasi (dipakai oleh NotifikasiPengambilan via context)
  useEffect(() => {
    api.get('/barang-masuk-nota/jumlah-menunggu').catch(() => {});
  }, [location.pathname]);

  function keluarDariSesi() {
    authStorage.hapusDevice();
    navigate('/setup-device');
  }

  return (
    <div className="admin-app">
      <AdminGudangSidebar deviceInfo={deviceInfo} onLogout={keluarDariSesi} />

      <div className="admin-main">
        {/* Mobile header */}
        <header className="mobile-header">
          <div className="mobile-header__left">
            <div style={{ background: 'white', borderRadius: 8, padding: 3, display: 'flex', flexShrink: 0 }}>
              <img src="/logo.png" alt="Pancong Jaksel" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            </div>
            <div>
              <div className="mobile-header__title">Pancong Jaksel</div>
              <div className="mobile-header__subtitle">{deviceInfo?.nama || 'Admin Gudang'}</div>
            </div>
          </div>
          <div className="mobile-header__action" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotifikasiPengambilan />
            <button className="mobile-header__logout" onClick={keluarDariSesi}>
              Keluar
            </button>
          </div>
        </header>

        <main className="admin-content">
          <ApprovalCenterCards role="admin_gudang" />
          <Outlet />
        </main>
      </div>

      <BottomNav role="admin_gudang" />
    </div>
  );
}
