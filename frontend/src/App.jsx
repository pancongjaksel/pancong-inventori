import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import SetupDevice from './pages/SetupDevice';
import CrewShell from './pages/CrewShell';
import AmbilBarang from './pages/AmbilBarang';
import BarangMasukCrew from './pages/BarangMasukCrew';
import AdminShell from './pages/admin/AdminShell';
import Dashboard from './pages/admin/Dashboard';
import BarangMasukAdmin from './pages/admin/BarangMasukAdmin';
import VerifikasiBarangMasuk from './pages/admin/VerifikasiBarangMasuk';
import TransferGudang from './pages/admin/TransferGudang';
import StokOpname from './pages/admin/StokOpname';
import KoreksiTransaksi from './pages/admin/KoreksiTransaksi';
import LaporanForecast from './pages/admin/LaporanForecast';
import ManajemenItem from './pages/admin/ManajemenItem';
import ManajemenOutlet from './pages/admin/ManajemenOutlet';
import ManajemenUser from './pages/admin/ManajemenUser';
import ManajemenDevice from './pages/admin/ManajemenDevice';
import { authStorage } from './api/client';

/** Halaman awal: arahkan otomatis sesuai status login/setup yang tersimpan. */
function HalamanAwal() {
  if (authStorage.ambilDeviceToken()) return <Navigate to="/crew" replace />;
  if (authStorage.ambilAdminToken()) return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HalamanAwal />} />
        <Route path="/login" element={<Login />} />
        <Route path="/setup-device" element={<SetupDevice />} />

        <Route path="/crew" element={<CrewShell />}>
          <Route index element={<AmbilBarang />} />
          <Route path="masuk" element={<BarangMasukCrew />} />
        </Route>

        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<Dashboard />} />
          <Route path="barang-masuk" element={<BarangMasukAdmin />} />
          <Route path="verifikasi" element={<VerifikasiBarangMasuk />} />
          <Route path="transfer" element={<TransferGudang />} />
          <Route path="opname" element={<StokOpname />} />
          <Route path="koreksi" element={<KoreksiTransaksi />} />
          <Route path="laporan" element={<LaporanForecast />} />
          <Route path="item" element={<ManajemenItem />} />
          <Route path="outlet" element={<ManajemenOutlet />} />
          <Route path="device" element={<ManajemenDevice />} />
          <Route path="user" element={<ManajemenUser />} />
        </Route>
        {/* Rute Admin lain (modul Produksi & BOM, Fase 2) menyusul */}
      </Routes>
    </BrowserRouter>
  );
}
