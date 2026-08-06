import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, authStorage } from '../../api/client';

const TAB_STYLE = ({ isActive }) => ({
  padding: '8px 14px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  color: isActive ? 'var(--warna-krim)' : 'var(--warna-krim-redup)',
  background: isActive ? 'var(--warna-karamel)' : 'transparent',
  whiteSpace: 'nowrap',
});

export default function AdminShell() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);

  useEffect(() => {
    api.get('/auth/me').then((data) => setRole(data.user.role)).catch(() => {});
  }, []);

  function logout() {
    authStorage.hapusAdminToken();
    navigate('/login');
  }

  return (
    <div className="layar">
      <div className="top-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="top-bar__judul">Inventori Pancong Jaksel</span>
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', color: 'var(--warna-krim-redup)', fontSize: 13, cursor: 'pointer' }}
          >
            Keluar
          </button>
        </div>
        <nav style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          <NavLink to="/admin" end style={TAB_STYLE}>Dashboard</NavLink>
          <NavLink to="/admin/barang-masuk" style={TAB_STYLE}>Barang Masuk</NavLink>
          <NavLink to="/admin/verifikasi" style={TAB_STYLE}>Verifikasi</NavLink>
          <NavLink to="/admin/transfer" style={TAB_STYLE}>Transfer</NavLink>
          <NavLink to="/admin/opname" style={TAB_STYLE}>Opname</NavLink>
          <NavLink to="/admin/koreksi" style={TAB_STYLE}>Koreksi</NavLink>
          <NavLink to="/admin/laporan" style={TAB_STYLE}>Laporan</NavLink>
          <NavLink to="/admin/item" style={TAB_STYLE}>Item</NavLink>
          <NavLink to="/admin/outlet" style={TAB_STYLE}>Outlet</NavLink>
          <NavLink to="/admin/device" style={TAB_STYLE}>Device</NavLink>
          {role === 'owner' && <NavLink to="/admin/user" style={TAB_STYLE}>User</NavLink>}
          <NavLink to="/setup-device" style={TAB_STYLE}>Setup Device</NavLink>
        </nav>
      </div>
      <div className="konten">
        <Outlet />
      </div>
    </div>
  );
}
