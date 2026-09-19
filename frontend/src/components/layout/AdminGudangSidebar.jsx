import { NavLink } from 'react-router-dom';
import NotifikasiPengambilan from '../NotifikasiPengambilan';

const NAV_ITEMS = [
  { to: '/admin-gudang', label: 'Beranda', end: true },
  { to: '/admin-gudang/stok-saat-ini', label: 'Persediaan' },
  { section: 'Transaksi' },
  { to: '/admin-gudang/transaksi/penerimaan', label: 'Penerimaan', indent: true },
  { to: '/admin-gudang/transaksi/pemindahan', label: 'Pemindahan', indent: true },
  { to: '/admin-gudang/transaksi/pengeluaran', label: 'Pengeluaran', indent: true },
  { to: '/admin-gudang/verifikasi', label: 'Verifikasi Penerimaan' },
  { to: '/admin-gudang/opname', label: 'Stok Opname' },
  { to: '/admin-gudang/laporan', label: 'Laporan' },
  { to: '/admin-gudang/koreksi', label: 'Penyesuaian' },
  { to: '/admin-gudang/riwayat-transfer', label: 'Riwayat Pemindahan' },
  { to: '/admin-gudang/riwayat-barang-masuk', label: 'Riwayat Penerimaan' },
];

export default function AdminGudangSidebar({ deviceInfo, onLogout }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__logo" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'white', borderRadius: 9, padding: 3, display: 'flex', flexShrink: 0 }}>
            <img src="/logo.png" alt="Pancong Jaksel" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warna-krim)' }}>Pancong Jaksel</div>
            <div style={{ fontSize: 11, color: 'var(--warna-abu)' }}>Admin Gudang</div>
          </div>
        </div>
        <NotifikasiPengambilan />
      </div>

      <nav className="admin-sidebar__nav">
        {NAV_ITEMS.map((item, i) => {
          if (item.section) {
            return (
              <div key={`section-${i}`} style={{
                fontSize: 10, fontWeight: 700,
                color: 'var(--warna-abu)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '12px 16px 4px',
              }}>
                {item.section}
              </div>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `admin-sidebar__item${isActive ? ' admin-sidebar__item--active' : ''}`
              }
              style={item.indent ? { paddingLeft: 28, fontSize: 13 } : undefined}
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="admin-sidebar__footer">
        <span style={{ fontSize: 12, color: 'var(--warna-abu)' }}>{deviceInfo?.nama}</span>
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
