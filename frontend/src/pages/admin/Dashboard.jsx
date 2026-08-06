import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

export default function Dashboard() {
  const [stokMenipis, setStokMenipis] = useState([]);
  const [stokGudang, setStokGudang] = useState([]);
  const [gudangDipilih, setGudangDipilih] = useState('semua');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/laporan/stok-menipis'), api.get('/laporan/stok-gudang')])
      .then(([menipis, gudang]) => {
        setStokMenipis(menipis);
        setStokGudang(gudang);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }, []);

  const daftarGudang = [...new Set(stokGudang.map((r) => r.nama_gudang))];
  const stokTampil = gudangDipilih === 'semua' ? stokGudang : stokGudang.filter((r) => r.nama_gudang === gudangDipilih);

  if (loading) return <p style={{ color: 'var(--warna-abu)' }}>Memuat...</p>;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}

      {stokMenipis.length > 0 && (
        <div className="kartu" style={{ borderColor: 'var(--warna-bahaya)', marginBottom: 20 }}>
          <p style={{ fontWeight: 700, color: 'var(--warna-bahaya)', marginTop: 0 }}>
            ⚠ {stokMenipis.length} item stoknya menipis
          </p>
          {stokMenipis.map((r) => (
            <div key={`${r.gudang_id}-${r.item_id}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', borderTop: '1px solid var(--warna-garis)' }}>
              <span>{r.nama_item} <span style={{ color: 'var(--warna-abu)' }}>({r.nama_gudang})</span></span>
              <span style={{ fontFamily: 'var(--font-angka)' }}>{r.stok_saat_ini} / min {r.reorder_point} {r.satuan}</span>
            </div>
          ))}
        </div>
      )}
      {stokMenipis.length === 0 && (
        <div className="pesan-sukses" style={{ marginBottom: 20 }}>Gak ada item yang stoknya menipis saat ini.</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
        <button
          className="tombol tombol--sekunder"
          style={{ width: 'auto', padding: '0 16px', background: gudangDipilih === 'semua' ? 'var(--warna-krim-redup)' : undefined }}
          onClick={() => setGudangDipilih('semua')}
        >
          Semua Gudang
        </button>
        {daftarGudang.map((nama) => (
          <button
            key={nama}
            className="tombol tombol--sekunder"
            style={{ width: 'auto', padding: '0 16px', background: gudangDipilih === nama ? 'var(--warna-krim-redup)' : undefined }}
            onClick={() => setGudangDipilih(nama)}
          >
            {nama}
          </button>
        ))}
      </div>

      <p className="label">Stok saat ini</p>
      {stokTampil.map((r) => (
        <div key={`${r.gudang_id}-${r.item_id}`} className="kartu" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 600 }}>{r.nama_item}</div>
            <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>{r.nama_gudang}</div>
          </div>
          <div style={{ fontFamily: 'var(--font-angka)', fontWeight: 700, alignSelf: 'center' }}>
            {r.stok_saat_ini} {r.satuan}
          </div>
        </div>
      ))}
    </div>
  );
}
