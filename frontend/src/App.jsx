import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import SetupDevice from './pages/SetupDevice';
import CrewShell from './pages/CrewShell';
import CrewHome from './pages/CrewHome';
import AmbilBarang from './pages/AmbilBarang';
import BarangMasukCrew from './pages/BarangMasukCrew';
import OpnameOutletCrew from './pages/crew/OpnameOutletCrew';
import CrewRiwayat from './pages/CrewRiwayat';
import PengambilanDetail from './pages/crew/PengambilanDetail';
import NotifikasiCrew from './pages/crew/NotifikasiCrew';
const AdminGudangShell = lazy(() => import('./pages/AdminGudangShell'));
const AdminShell = lazy(() => import('./pages/admin/AdminShell'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const BarangMasukAdmin = lazy(() => import('./pages/admin/BarangMasukAdmin'));
const BarangMasukAdminGudang = lazy(() => import('./pages/admin/BarangMasukAdminGudang'));
const VerifikasiBarangMasuk = lazy(() => import('./pages/admin/VerifikasiBarangMasuk'));
const TransferGudang = lazy(() => import('./pages/admin/TransferGudang'));
const StokOpname = lazy(() => import('./pages/admin/StokOpname'));
const ApprovalOpname = lazy(() => import('./components/ApprovalOpname'));
const KoreksiTransaksi = lazy(() => import('./pages/admin/KoreksiTransaksi'));
const LaporanForecast = lazy(() => import('./pages/admin/LaporanForecast'));
const PengambilanOutletGudang = lazy(() => import('./pages/PengambilanOutletGudang'));
const StokSaatIni = lazy(() => import('./pages/admin/StokSaatIni'));
const RiwayatPenyesuaian = lazy(() => import('./pages/admin/RiwayatPenyesuaian'));
const LogAktivitas = lazy(() => import('./pages/admin/LogAktivitas'));
const ManajemenItem = lazy(() => import('./pages/admin/ManajemenItem'));
const ManajemenOutlet = lazy(() => import('./pages/admin/ManajemenOutlet'));
const ManajemenUser = lazy(() => import('./pages/admin/ManajemenUser'));
const ManajemenDevice = lazy(() => import('./pages/admin/ManajemenDevice'));
const StokGudang = lazy(() => import('./pages/admin/StokGudang'));
const OpnameOutlet = lazy(() => import('./pages/admin/OpnameOutlet'));
const ApprovalOpnameOutlet = lazy(() => import('./pages/admin/ApprovalOpnameOutlet'));
const RiwayatPengambilan = lazy(() => import('./pages/admin/RiwayatPengambilan'));
const PengambilanDetailAdmin = lazy(() => import('./pages/admin/PengambilanDetailAdmin'));
const RiwayatTransfer = lazy(() => import('./pages/admin/RiwayatTransfer'));
const RiwayatTransferDetail = lazy(() => import('./pages/admin/RiwayatTransferDetail'));
const RiwayatBarangMasuk = lazy(() => import('./pages/admin/RiwayatBarangMasuk'));
const RiwayatBarangMasukDetail = lazy(() => import('./pages/admin/RiwayatBarangMasukDetail'));
const TransaksiHub = lazy(() => import('./pages/admin/TransaksiHub'));
import { authStorage } from './api/client';

function HalamanAwal() {
  if (authStorage.ambilDeviceToken()) {
    return authStorage.ambilDeviceRole() === 'admin_gudang'
      ? <Navigate to="/admin-gudang" replace />
      : <Navigate to="/crew" replace />;
  }
  if (authStorage.ambilAdminToken()) return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{ padding: 24 }}>Memuat halaman…</div>}>
      <Routes>
        <Route path="/" element={<HalamanAwal />} />
        <Route path="/login" element={<Login />} />
        <Route path="/setup-device" element={<SetupDevice />} />

        <Route path="/crew" element={<CrewShell />}>
          <Route index element={<CrewHome />} />
          <Route path="ambil" element={<AmbilBarang />} />
          <Route path="masuk" element={<BarangMasukCrew />} />
          <Route path="opname" element={<OpnameOutletCrew />} />
          <Route path="riwayat" element={<CrewRiwayat />} />
          <Route path="riwayat/:id" element={<PengambilanDetail />} />
          <Route path="notifikasi" element={<NotifikasiCrew />} />
        </Route>

        <Route path="/admin-gudang" element={<AdminGudangShell />}>
          <Route index element={<StokSaatIni />} />
          <Route path="stok-saat-ini" element={<StokSaatIni />} />
          <Route path="opname" element={<StokOpname />} />
          <Route path="laporan" element={<LaporanForecast />} />
          <Route path="koreksi" element={<KoreksiTransaksi />} />
          <Route path="riwayat-transfer" element={<RiwayatTransfer />} />
          <Route path="riwayat-transfer/:id" element={<RiwayatTransferDetail />} />
          <Route path="riwayat-barang-masuk" element={<RiwayatBarangMasuk />} />
          <Route path="riwayat-barang-masuk/:id" element={<RiwayatBarangMasukDetail />} />
          <Route path="transaksi" element={<TransaksiHub basePath="/admin-gudang/transaksi" />}>
            <Route path="penerimaan" element={<BarangMasukAdminGudang />} />
            <Route path="pemindahan" element={<TransferGudang />} />
            <Route path="pengeluaran" element={<PengambilanOutletGudang />} />
          </Route>
          {/* Legacy routes — dipertahankan untuk backward compat */}
          <Route path="barang-masuk" element={<BarangMasukAdminGudang />} />
          <Route path="verifikasi" element={<VerifikasiBarangMasuk />} />
          <Route path="transfer" element={<TransferGudang />} />
          <Route path="pengambilan-outlet" element={<PengambilanOutletGudang />} />
          <Route path="opname-outlet" element={<OpnameOutlet />} />
        </Route>

        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<Dashboard />} />
          <Route path="barang-masuk" element={<BarangMasukAdmin />} />
          <Route path="verifikasi" element={<VerifikasiBarangMasuk />} />
          <Route path="transfer" element={<TransferGudang />} />
          <Route path="stok" element={<StokGudang />} />
          <Route path="opname" element={<StokOpname />} />
          <Route path="opname/approval" element={<ApprovalOpname />} />
          <Route path="opname/approval-outlet" element={<ApprovalOpnameOutlet />} />
          <Route path="koreksi" element={<KoreksiTransaksi />} />
          <Route path="laporan" element={<LaporanForecast />} />
          <Route path="stok-saat-ini" element={<StokSaatIni />} />
          <Route path="riwayat-penyesuaian" element={<RiwayatPenyesuaian />} />
          <Route path="log-aktivitas" element={<LogAktivitas />} />
          <Route path="item" element={<ManajemenItem />} />
          <Route path="outlet" element={<ManajemenOutlet />} />
          <Route path="device" element={<ManajemenDevice />} />
          <Route path="user" element={<ManajemenUser />} />
          <Route path="riwayat-pengambilan" element={<RiwayatPengambilan />} />
          <Route path="riwayat-pengambilan/:id" element={<PengambilanDetailAdmin />} />
          <Route path="riwayat-transfer" element={<RiwayatTransfer />} />
          <Route path="riwayat-transfer/:id" element={<RiwayatTransferDetail />} />
          <Route path="riwayat-barang-masuk" element={<RiwayatBarangMasuk />} />
          <Route path="riwayat-barang-masuk/:id" element={<RiwayatBarangMasukDetail />} />
          <Route path="transaksi" element={<TransaksiHub />}>
            <Route path="penerimaan" element={<BarangMasukAdmin />} />
            <Route path="pemindahan" element={<TransferGudang />} />
            <Route path="pengeluaran" element={<RiwayatPengambilan />} />
          </Route>
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
