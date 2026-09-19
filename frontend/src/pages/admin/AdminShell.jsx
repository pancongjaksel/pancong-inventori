import { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { api, authStorage } from '../../api/client';
import BottomNav from '../../components/layout/BottomNav';
import AdminSidebar from '../../components/layout/AdminSidebar';
import NotifikasiPengambilan from '../../components/NotifikasiPengambilan';

export default function AdminShell() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.get('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => {
        authStorage.hapusAdminToken();
        navigate('/login', { replace: true });
      });
  }, [navigate]);

  const roleLabel = useMemo(() => {
    if (user?.role === 'owner') return 'Owner';
    if (user?.role === 'admin_gudang') return 'Admin Gudang';
    return 'Admin';
  }, [user]);

  function logout() {
    authStorage.hapusAdminToken();
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin-app">
      <AdminSidebar user={user} roleLabel={roleLabel} onLogout={logout} />

      <div className="admin-main">
        {/* Mobile header — hanya tampil di layar kecil, sidebar muncul di desktop */}
        <header className="mobile-header">
          <div className="mobile-header__left">
            <div style={{ background: 'white', borderRadius: 8, padding: 3, display: 'flex', flexShrink: 0 }}>
              <img src="/logo.png" alt="Pancong Jaksel" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            </div>
            <div>
              <div className="mobile-header__title">Pancong Jaksel</div>
              <div className="mobile-header__subtitle">{roleLabel}</div>
            </div>
          </div>
          <div className="mobile-header__action" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotifikasiPengambilan />
            <button className="mobile-header__logout" onClick={logout}>
              Keluar
            </button>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>

      <BottomNav role="admin" />
    </div>
  );
}
