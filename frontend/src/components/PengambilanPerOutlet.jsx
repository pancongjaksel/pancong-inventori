import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client';

function awalBulanIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function hariIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Rekap total qty per item yang sudah diambil sebuah outlet dalam rentang tanggal.
 * Dipakai di dua tempat: section di LaporanForecast (admin) dan halaman
 * standalone di /admin-gudang/pengambilan-outlet (admin gudang).
 * Sengaja tidak render judul sendiri — pemanggil yang kasih heading.
 */
export default function PengambilanPerOutlet() {
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState('');
  const [dariTanggal, setDariTanggal] = useState(awalBulanIni());
  const [sampaiTanggal, setSampaiTanggal] = useState(hariIni());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/master/outlets').then((list) => setOutlets(list || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!outletId) {
      setData([]);
      return;
    }
    (async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          outlet_id: outletId,
          dari_tanggal: dariTanggal,
          sampai_tanggal: sampaiTanggal,
        });
        const hasil = await api.get(`/laporan/pengambilan-per-outlet?${params.toString()}`);
        setData(Array.isArray(hasil) ? hasil : []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat data pengambilan outlet.');
      } finally {
        setLoading(false);
      }
    })();
  }, [outletId, dariTanggal, sampaiTanggal]);

  const formatQty = (nilai) => {
    const angka = Number(nilai);
    return Number.isFinite(angka) ? angka.toLocaleString('id-ID') : nilai;
  };

  const formatRupiah = (nilai) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nilai ?? 0);

  return (
    <div>
      <div className="riwayat-filter">
        <select
          className="input-teks"
          value={outletId}
          onChange={(e) => setOutletId(e.target.value)}
          style={{ width: 'auto', padding: '0 12px' }}
        >
          <option value="">Pilih outlet</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>{o.nama}</option>
          ))}
        </select>
        <input
          type="date"
          className="input-teks"
          value={dariTanggal}
          onChange={(e) => setDariTanggal(e.target.value)}
          style={{ width: 'auto' }}
        />
        <span style={{ alignSelf: 'center', color: 'var(--warna-abu)', fontSize: 13 }}>s/d</span>
        <input
          type="date"
          className="input-teks"
          value={sampaiTanggal}
          onChange={(e) => setSampaiTanggal(e.target.value)}
          style={{ width: 'auto' }}
        />
      </div>

      {error && <div className="pesan-error">{error}</div>}

      {!outletId && !error && (
        <p style={{ color: 'var(--warna-abu)', fontSize: 14 }}>Pilih outlet dulu buat lihat rekap pengambilannya.</p>
      )}

      {outletId && loading && <p style={{ fontSize: 14, color: 'var(--warna-abu)' }}>Memuat data...</p>}

      {outletId && !loading && !error && (
        <>
          <p style={{ fontSize: 13, color: 'var(--warna-abu)', marginBottom: 8 }}>
            {data.length} item &middot; {dariTanggal} s/d {sampaiTanggal}
          </p>
          {data.length === 0 && (
            <p style={{ color: 'var(--warna-abu)', fontSize: 14 }}>Belum ada pengambilan untuk outlet ini di periode yang dipilih.</p>
          )}
          {data.map((r) => (
            <div key={r.item_id} className="kartu" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.nama_item}</div>
                  <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>{r.kode_barang}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-angka)', fontWeight: 700 }}>
                    {formatQty(r.total_qty)} {r.satuan}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>
                    {formatRupiah(r.harga)} / {r.satuan}
                  </div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-angka)', color: 'var(--warna-arang)' }}>
                    {formatRupiah(r.subtotal)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {data.length > 0 && (() => {
            const totalNilai = data.reduce((sum, row) => sum + (row.subtotal || 0), 0);
            return (
              <div style={{ borderTop: '2px solid var(--warna-garis)', marginTop: 8, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Total Nilai</span>
                <span style={{ fontFamily: 'var(--font-angka)', fontWeight: 700, fontSize: 16 }}>{formatRupiah(totalNilai)}</span>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
