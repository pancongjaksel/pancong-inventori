import { useNavigate } from 'react-router-dom';
import { authStorage } from '../api/client';

export default function CrewHome() {
  const navigate = useNavigate();
  const deviceInfo = authStorage.ambilDeviceInfo();

  const namaHari = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="mobile-page">
      <div className="mobile-page__content">

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Halo, {deviceInfo?.nama || 'Crew'}! Have a nice day!</div>
          <div style={{ fontSize: 13, color: 'var(--warna-abu)', marginTop: 3 }}>{namaHari}</div>
        </div>

        <div style={{
          background: 'var(--warna-arang)',
          borderRadius: 14,
          padding: '16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#c0b4a8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Gudang terhubung
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
              {deviceInfo?.namaGudang || '—'}
            </div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 11,
            background: 'var(--warna-karamel)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: 'white',
          }}>
            ▣
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Aktivitas
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          <ActionCard
            icon="▣"
            title="Ambil Barang"
            sub="Catat pengambilan dari gudang"
            primer
            onClick={() => navigate('/crew/ambil')}
          />
          <ActionCard
            icon="＋"
            title="Barang Masuk"
            sub="Terima kiriman dari supplier"
            onClick={() => navigate('/crew/masuk')}
          />
          <ActionCard
            icon="✓"
            title="Opname Outlet"
            sub="Hitung stok fisik"
            onClick={() => navigate('/crew/opname')}
          />
          <ActionCard
            icon="◷"
            title="Riwayat"
            sub="Transaksi hari ini"
            onClick={() => navigate('/crew/riwayat')}
          />
        </div>

      </div>
    </div>
  );
}

function ActionCard({ icon, title, sub, primer, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: primer ? 'var(--warna-karamel)' : 'white',
        border: primer ? 'none' : '1px solid var(--warna-garis)',
        borderRadius: 14,
        padding: 16,
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: primer ? 'rgba(255,255,255,0.2)' : 'var(--warna-krim-redup)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, marginBottom: 10,
        color: primer ? 'white' : 'var(--warna-karamel)',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: primer ? 'white' : 'var(--warna-arang)', lineHeight: 1.2 }}>
        {title}
      </div>
      <div style={{ fontSize: 11, color: primer ? 'rgba(255,255,255,0.75)' : 'var(--warna-abu)', marginTop: 3 }}>
        {sub}
      </div>
    </button>
  );
}
