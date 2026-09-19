import PengambilanPerOutlet from '../components/PengambilanPerOutlet';

export default function PengambilanOutletGudang() {
  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Pengambilan per Outlet</h1>
      <p style={{ color: 'var(--warna-abu)', marginTop: 0, marginBottom: 20 }}>
        Total item yang sudah diambil tiap outlet, dalam rentang tanggal yang dipilih.
      </p>
      <PengambilanPerOutlet />
    </div>
  );
}
