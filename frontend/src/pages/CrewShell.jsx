import { NavLink, Outlet } from 'react-router-dom';
import { authStorage } from '../api/client';

const TAB_STYLE = ({ isActive }) => ({
  flex: 1,
  textAlign: 'center',
  padding: '10px 0',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  color: isActive ? 'var(--warna-krim)' : 'var(--warna-krim-redup)',
  background: isActive ? 'var(--warna-karamel)' : 'transparent',
});

export default function CrewShell() {
  const deviceInfo = authStorage.ambilDeviceInfo();

  return (
    <div className="layar">
      <div className="top-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div>
          <div className="top-bar__judul">Inventori Pancong Jaksel</div>
          <div className="top-bar__konteks">{deviceInfo?.namaGudang}</div>
        </div>
        <nav style={{ display: 'flex', gap: 8 }}>
          <NavLink to="/crew" end style={TAB_STYLE}>Ambil Barang</NavLink>
          <NavLink to="/crew/masuk" style={TAB_STYLE}>Barang Masuk</NavLink>
        </nav>
      </div>
      {/* Outlet SENGAJA gak dibungkus div .konten di sini — child page (AmbilBarang,
          BarangMasukCrew) masing-masing punya .konten + .tombol-utama-bawah
          sendiri sebagai saudara langsung, biar tombol sticky di bawah kerja
          bener (butuh jadi flex child langsung dari .layar, bukan ketumpuk
          di dalam .konten). */}
      <Outlet />
    </div>
  );
}
