import { useState, useEffect, useMemo } from 'react';
import { api, ApiError, authStorage } from '../../api/client';

export default function RiwayatPenyesuaian() {
  const isAdminGudang = authStorage.ambilDeviceRole() === 'admin_gudang';

  const [data, setData] = useState([]);
  const [gudangs, setGudangs] = useState([]);
  const [gudangFilter, setGudangFilter] = useState('semua');
  const [dariTanggal, setDariTanggal] = useState('');
  const [sampaiTanggal, setSampaiTanggal] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAdminGudang) return;
    (async () => {
      try {
        const gudangList = await api.get('/master/gudangs');
        setGudangs(gudangList || []);
      } catch {
        // non-blocking
      }
    })();
  }, [isAdminGudang]);

  useEffect(() => {
    if (isAdminGudang) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (gudangFilter !== 'semua') params.set('gudang_id', gudangFilter);
        if (dariTanggal) params.set('dari_tanggal', dariTanggal);
        if (sampaiTanggal) params.set('sampai_tanggal', sampaiTanggal);
        const hasil = await api.get(`/laporan/riwayat-penyesuaian?${params.toString()}`);
        setData(Array.isArray(hasil) ? hasil : []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat penyesuaian.');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdminGudang, gudangFilter, dariTanggal, sampaiTanggal]);

  const totalSelisih = useMemo(
    () => data.reduce((sum, r) => sum + Math.abs(Number(r.selisih) || 0), 0),
    [data]
  );

  if (isAdminGudang) {
    return (
      <div>
        <h1>Riwayat Penyesuaian Stok</h1>
        <p style={{ color: 'var(--warna-abu)' }}>Halaman ini khusus admin/owner.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Riwayat Penyesuaian Stok</h1>
      <p style={{ color: 'var(--warna-abu)', marginTop: 0, marginBottom: 20 }}>
        Semua penyesuaian stok sistem yang pernah dipicu lewat Stok Opname.
      </p>

      <div className="riwayat-filter">
        <select className="input-teks" value={gudangFilter} onChange={(e) => setGudangFilter(e.target.value)} style={{ padding: '0 12px' }}>
          <option value="semua">Semua Gudang</option>
          {gudangs.map((g) => (
            <option key={g.id} value={g.id}>Gudang {g.nama}</option>
          ))}
        </select>
        <input type="date" className="input-teks" value={dariTanggal} onChange={(e) => setDariTanggal(e.target.value)} />
        <span className="riwayat-filter__pemisah" style={{ alignSelf: 'center' }}>s/d</span>
        <input type="date" className="input-teks" value={sampaiTanggal} onChange={(e) => setSampaiTanggal(e.target.value)} />
      </div>

      {loading && <p>Memuat data...</p>}
      {error && <div className="pesan-error">{error}</div>}

      {!loading && !error && (
        <>
          <p style={{ fontSize: 13, color: 'var(--warna-abu)', marginBottom: 8 }}>
            {data.length} penyesuaian ditemukan · total |selisih| {totalSelisih.toLocaleString('id-ID')}
          </p>
          <div className="kartu stok-tabel-wrapper" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="stok-tabel" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--warna-garis)' }}>
                  <th style={{ padding: '10px 14px' }}>Tanggal</th>
                  <th style={{ padding: '10px 14px' }}>Gudang</th>
                  <th style={{ padding: '10px 14px' }}>Item</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Stok Sistem</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Stok Fisik</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Selisih</th>
                  <th style={{ padding: '10px 14px' }}>Jenis</th>
                  <th style={{ padding: '10px 14px' }}>Dicatat oleh</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.ledger_id} style={{ borderBottom: '1px solid var(--warna-garis)' }}>
                    <td data-label="Tanggal" style={{ padding: '10px 14px' }}>{r.tanggal}</td>
                    <td data-label="Gudang" style={{ padding: '10px 14px' }}>{r.nama_gudang}</td>
                    <td data-label="Item" style={{ padding: '10px 14px' }}>{r.nama_item}</td>
                    <td data-label="Stok Sistem" style={{ padding: '10px 14px', textAlign: 'right' }}>{r.stok_sistem_sebelum}</td>
                    <td data-label="Stok Fisik" style={{ padding: '10px 14px', textAlign: 'right' }}>{r.stok_fisik}</td>
                    <td data-label="Selisih" style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--warna-bahaya)' }}>
                      {Number(r.selisih) > 0 ? `+${r.selisih}` : r.selisih}
                    </td>
                    <td data-label="Jenis" style={{ padding: '10px 14px' }}>{r.jenis_opname}</td>
                    <td data-label="Dicatat oleh" style={{ padding: '10px 14px' }}>{r.dicatat_oleh}</td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--warna-abu)' }}>
                      Belum ada penyesuaian tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
