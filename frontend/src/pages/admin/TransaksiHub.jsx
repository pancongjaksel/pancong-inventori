import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';

const SUB_TABS = [
  { to: 'penerimaan', label: 'Penerimaan' },
  { to: 'pemindahan', label: 'Pemindahan' },
  { to: 'pengeluaran', label: 'Pengeluaran' },
];

export default function TransaksiHub({ basePath = '/admin/transaksi' }) {
  const location = useLocation();
  const isRoot = location.pathname === basePath || location.pathname === basePath + '/';

  if (isRoot) {
    return <Navigate to={`${basePath}/penerimaan`} replace />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid var(--warna-garis)',
        background: 'white',
        flexShrink: 0,
      }}>
        {SUB_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            style={({ isActive }) => ({
              flex: 1,
              padding: '13px 8px',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: isActive ? 'var(--warna-karamel)' : 'var(--warna-abu)',
              textDecoration: 'none',
              borderBottom: isActive ? '2px solid var(--warna-karamel)' : '2px solid transparent',
              marginBottom: -2,
              background: 'transparent',
              transition: 'color 0.15s',
            })}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </div>
    </div>
  );
}
