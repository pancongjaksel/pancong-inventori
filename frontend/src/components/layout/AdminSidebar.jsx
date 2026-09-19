import { NavLink, useNavigate } from 'react-router-dom';
import NotifikasiPengambilan from '../NotifikasiPengambilan';

const NAV_ITEMS = [
  { to: '/admin', label: 'Beranda', end: true },
  { to: '/admin/barang-masuk', label: 'Penerimaan' },
  { to: '/admin/transfer', label: 'Pemindahan' },
  { to: '/admin/opname', label: 'Opname' },
  { to: '/admin/koreksi', label: 'Penyesuaian' },
  { to: '/admin/laporan', label: 'Laporan' },
  { to: '/admin/stok-saat-ini', label: 'Persediaan' },
  { to: '/admin/riwayat-pengambilan', label: 'Pengeluaran' },
  { to: '/admin/riwayat-transfer', label: 'Riwayat Pemindahan' },
  { to: '/admin/riwayat-barang-masuk', label: 'Riwayat Penerimaan' },
  { to: '/admin/item', label: 'Produk' },
  { to: '/admin/outlet', label: 'Gerai' },
  { to: '/admin/user', label: 'Pengguna' },
];

export default function AdminSidebar({ user, roleLabel, onLogout }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__logo" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'white', borderRadius: 9, padding: 3, display: 'flex', flexShrink: 0 }}>
            <img src="/logo.png" alt="Pancong Jaksel" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warna-krim)' }}>Pancong Jaksel</div>
            <div style={{ fontSize: 11, color: 'var(--warna-abu)' }}>{roleLabel}</div>
          </div>
        </div>
        <NotifikasiPengambilan />
      </div>

      <nav className="admin-sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `admin-sidebar__item${isActive ? ' admin-sidebar__item--active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar__footer">
        <span style={{ fontSize: 12, color: 'var(--warna-abu)' }}>{user?.nama}</span>
        <button
          onClick={onLogout}
          style={{
            background: 'none', border: 'none',
            color: 'var(--warna-abu)', fontSize: 12,
            cursor: 'pointer', padding: 0,
          }}
        >
          Keluar
        </button>
      </div>
    </aside>
  );
}
