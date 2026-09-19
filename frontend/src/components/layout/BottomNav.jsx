import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

// ─── Admin (owner/admin) ─────────────────────────────────────────────────────

const DRAWER_ITEMS_ADMIN = [
  { to: '/admin/laporan', label: 'Laporan' },
  { to: '/admin/koreksi', label: 'Penyesuaian' },
  { to: '/admin/riwayat-transfer', label: 'Riwayat Pemindahan' },
  { to: '/admin/riwayat-barang-masuk', label: 'Riwayat Penerimaan' },
  { to: '/admin/item', label: 'Produk' },
  { to: '/admin/outlet', label: 'Gerai' },
  { to: '/admin/user', label: 'Pengguna' },
];

const LAINNYA_PREFIXES_ADMIN = [
  '/admin/laporan', '/admin/koreksi',
  '/admin/riwayat-transfer', '/admin/riwayat-barang-masuk',
  '/admin/item', '/admin/outlet', '/admin/user',
];

const TRANSAKSI_PREFIXES_ADMIN = [
  '/admin/transaksi', '/admin/barang-masuk',
  '/admin/transfer', '/admin/riwayat-pengambilan',
];

// ─── Admin Gudang ────────────────────────────────────────────────────────────

const DRAWER_ITEMS_GUDANG = [
  { to: '/admin-gudang/verifikasi', label: 'Verifikasi Penerimaan' },
  { to: '/admin-gudang/laporan', label: 'Laporan' },
  { to: '/admin-gudang/koreksi', label: 'Penyesuaian' },
  { to: '/admin-gudang/opname', label: 'Stok Opname' },
  { to: '/admin-gudang/riwayat-transfer', label: 'Riwayat Pemindahan' },
  { to: '/admin-gudang/riwayat-barang-masuk', label: 'Riwayat Penerimaan' },
];

const LAINNYA_PREFIXES_GUDANG = [
  '/admin-gudang/verifikasi',
  '/admin-gudang/laporan', '/admin-gudang/koreksi',
  '/admin-gudang/opname',
  '/admin-gudang/riwayat-transfer', '/admin-gudang/riwayat-barang-masuk',
];

const TRANSAKSI_PREFIXES_GUDANG = [
  '/admin-gudang/transaksi', '/admin-gudang/barang-masuk',
  '/admin-gudang/transfer', '/admin-gudang/pengambilan-outlet',
];

// ─── Shared components ───────────────────────────────────────────────────────

function NavItem({ to, icon, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`
      }
    >
      <span className="bottom-nav__icon">{icon}</span>
      <span className="bottom-nav__label">{label}</span>
    </NavLink>
  );
}

function Drawer({ buka, items }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: 0, right: 0, bottom: 0,
        background: 'var(--warna-krim)',
        borderRadius: '18px 18px 0 0',
        paddingBottom: 72,
        zIndex: 301,
        transform: buka ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
    >
      <div style={{
        width: 36, height: 4, background: 'var(--warna-garis)',
        borderRadius: 2, margin: '10px auto 14px',
      }} />
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        padding: '0 20px 10px',
      }}>
        Menu
      </div>
      {items.map((item, i) => (
        <NavLink
          key={item.to}
          to={item.to}
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center',
            padding: '13px 20px',
            borderTop: i === 0 ? '1px solid var(--warna-garis)' : 'none',
            borderBottom: '1px solid var(--warna-garis)',
            fontSize: 15,
            fontWeight: isActive ? 700 : 500,
            color: isActive ? 'var(--warna-karamel)' : 'var(--warna-arang)',
            textDecoration: 'none',
            background: isActive ? 'var(--warna-krim-redup)' : 'transparent',
          })}
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

// ─── Admin nav layout (shared between admin and admin_gudang) ─────────────────

function AdminNavLayout({
  berandaPath, persediaanPath, transaksiPath,
  transaksiPrefixes, lainnyaPrefixes, drawerItems,
}) {
  const [drawerBuka, setDrawerBuka] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setDrawerBuka(false); }, [location.pathname]);

  const lainnyaAktif = lainnyaPrefixes.some((p) => location.pathname.startsWith(p));
  const transaksiAktif = transaksiPrefixes.some((p) => location.pathname.startsWith(p));

  return (
    <>
      {drawerBuka && (
        <div
          onClick={() => setDrawerBuka(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }}
        />
      )}

      <Drawer buka={drawerBuka} items={drawerItems} />

      <nav
        className="bottom-nav"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', position: 'relative', zIndex: 302 }}
        aria-label="Navigasi utama"
      >
        <NavItem to={berandaPath} icon="⌂" label="Beranda" end />
        <NavItem to={persediaanPath} icon="▤" label="Persediaan" />

        <button
          className={`bottom-nav__item${transaksiAktif ? ' bottom-nav__item--active' : ''}`}
          onClick={() => navigate(transaksiPath)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}
        >
          <span className="bottom-nav__icon">⇄</span>
          <span className="bottom-nav__label">Transaksi</span>
        </button>

        <button
          className={`bottom-nav__item${lainnyaAktif ? ' bottom-nav__item--active' : ''}`}
          onClick={() => setDrawerBuka((v) => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}
        >
          <span className="bottom-nav__icon">≡</span>
          <span className="bottom-nav__label">Lainnya</span>
        </button>
      </nav>
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function BottomNav({ role }) {
  if (role === 'crew') {
    return (
      <nav className="bottom-nav" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }} aria-label="Navigasi utama">
        <NavItem to="/crew" icon="⌂" label="Home" end />
        <NavItem to="/crew/opname" icon="✓" label="Opname" />
        <NavItem to="/crew/riwayat" icon="◷" label="Riwayat" />
      </nav>
    );
  }

  if (role === 'admin_gudang') {
    return (
      <AdminNavLayout
        berandaPath="/admin-gudang"
        persediaanPath="/admin-gudang/stok-saat-ini"
        transaksiPath="/admin-gudang/transaksi"
        transaksiPrefixes={TRANSAKSI_PREFIXES_GUDANG}
        lainnyaPrefixes={LAINNYA_PREFIXES_GUDANG}
        drawerItems={DRAWER_ITEMS_GUDANG}
      />
    );
  }

  return (
    <AdminNavLayout
      berandaPath="/admin"
      persediaanPath="/admin/stok"
      transaksiPath="/admin/transaksi"
      transaksiPrefixes={TRANSAKSI_PREFIXES_ADMIN}
      lainnyaPrefixes={LAINNYA_PREFIXES_ADMIN}
      drawerItems={DRAWER_ITEMS_ADMIN}
    />
  );
}
