import { useState } from 'react';
import { api, downloadFile, ApiError } from '../../api/client';

function periodeSekarang() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function LaporanForecast() {
  const [periode, setPeriode] = useState(periodeSekarang());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  async function muatLaporan() {
    setLoading(true);
    setError(null);
    try {
      const hasil = await api.get(`/stok-opname/rekap?periode=${periode}`);
      setData(hasil);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat laporan.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      await downloadFile(`/stok-opname/rekap/export?periode=${periode}`, `Rekap-Opname-Forecast-${periode}.xlsx`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal download file.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input type="month" className="input-teks" value={periode} onChange={(e) => setPeriode(e.target.value)} />
        <button className="tombol tombol--primer" style={{ width: 'auto', padding: '0 20px' }} onClick={muatLaporan} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Muat laporan'}
        </button>
        <button className="tombol tombol--sekunder" style={{ width: 'auto', padding: '0 20px' }} onClick={handleDownload} disabled={downloading}>
          {downloading ? <span className="spinner" /> : '⬇ Excel'}
        </button>
      </div>

      {data && (
        <>
          <p className="label">Estimasi kebutuhan beli bulan depan (rata-rata pemakaian 3 bulan terakhir)</p>
          {data.forecastPembelian.length === 0 && (
            <p style={{ color: 'var(--warna-abu)', fontSize: 14 }}>Belum ada data pemakaian buat dihitung.</p>
          )}
          {data.forecastPembelian
            .filter((f) => f.estimasiKebutuhanBeli > 0)
            .map((f) => (
              <div key={f.kodeBarang} className="kartu" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{f.namaItem}</div>
                  <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>
                    Rata-rata pakai: {f.rataPemakaian3BulanTerakhir}/bulan · Stok saat ini: {f.stokSaatIni}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-angka)', fontWeight: 700, color: 'var(--warna-karamel)', alignSelf: 'center' }}>
                  beli {f.estimasiKebutuhanBeli} {f.satuan}
                </div>
              </div>
            ))}

          <p className="label" style={{ marginTop: 24 }}>Rekap opname periode {data.periode}</p>
          {data.rekapOpname.length === 0 && (
            <p style={{ color: 'var(--warna-abu)', fontSize: 14 }}>Belum ada opname yang diinput buat periode ini.</p>
          )}
          {data.rekapOpname.map((r, idx) => (
            <div key={idx} className="kartu" style={{ marginBottom: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{r.nama_item} — {r.nama_lokasi} ({r.lokasi_tipe})</div>
              <div style={{ color: 'var(--warna-abu)', marginTop: 4 }}>
                Awal: {r.stok_awal_periode} + Sistem/Diterima: {r.stok_sistem_atau_diterima} vs Fisik: {r.stok_fisik}
                {' → '}
                <span style={{ fontWeight: 700, color: Number(r.selisih) !== 0 ? 'var(--warna-bahaya)' : 'var(--warna-sukses)' }}>
                  Selisih: {r.selisih}
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
