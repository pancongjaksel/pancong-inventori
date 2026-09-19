import { useEffect, useState } from 'react';
import { api, downloadFile, ApiError } from '../../api/client';
import PengambilanPerOutlet from '../../components/PengambilanPerOutlet';
import OpnameOutlet from './OpnameOutlet';
import HppOutlet from './HppOutlet';

function periodeSekarang() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const TABS = [
  { key: 'forecast', label: 'Forecast & Opname' },
  { key: 'pengambilan', label: 'Pengambilan Outlet' },
  { key: 'opname_outlet', label: 'Opname Outlet' },
  { key: 'hpp', label: 'HPP Outlet' },
  { key: 'belanja', label: 'Belanja Bulanan' },
];

export default function LaporanForecast() {
  const [tab, setTab] = useState('forecast');
  const [periode, setPeriode] = useState(periodeSekarang());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [gudangId, setGudangId] = useState('');
  const [gudangList, setGudangList] = useState([]);
  const [belanjaData, setBelanjaData] = useState(null);
  const [loadingBelanja, setLoadingBelanja] = useState(false);
  const [downloadingBelanja, setDownloadingBelanja] = useState(false);

  useEffect(() => {
    api.get('/master/gudangs')
      .then((hasil) => setGudangList(Array.isArray(hasil) ? hasil : []))
      .catch(() => setGudangList([]));
  }, []);

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

  function queryBelanja() {
    const params = new URLSearchParams({ periode });
    if (gudangId) params.set('gudang_id', gudangId);
    return params.toString();
  }

  async function muatBelanja() {
    setLoadingBelanja(true);
    setError(null);
    try {
      setBelanjaData(await api.get(`/laporan/belanja-bulanan?${queryBelanja()}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat laporan belanja.');
    } finally {
      setLoadingBelanja(false);
    }
  }

  async function downloadBelanja() {
    setDownloadingBelanja(true);
    setError(null);
    try {
      await downloadFile(`/laporan/belanja-bulanan/export?${queryBelanja()}`, `Laporan-Belanja-${periode}.xlsx`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal download laporan belanja.');
    } finally {
      setDownloadingBelanja(false);
    }
  }

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className="tombol tombol--sekunder"
            style={{ width: 'auto', padding: '0 16px', flexShrink: 0, background: tab === t.key ? 'var(--warna-krim-redup)' : undefined }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'forecast' && (
        <div>
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
      )}

      {tab === 'pengambilan' && <PengambilanPerOutlet />}
      {tab === 'opname_outlet' && <OpnameOutlet />}
      {tab === 'hpp' && <HppOutlet />}

      {tab === 'belanja' && (
        <div>
          <p style={{ color: 'var(--warna-abu)', fontSize: 13, marginTop: 0 }}>
            Hanya penerimaan terverifikasi yang belum dibatalkan. Baris tanpa harga tidak dihitung dalam total nilai belanja.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <input type="month" className="input-teks" value={periode} onChange={(e) => setPeriode(e.target.value)} />
            <select className="input-teks" value={gudangId} onChange={(e) => setGudangId(e.target.value)} style={{ minWidth: 170 }}>
              <option value="">Semua gudang</option>
              {gudangList.map((gudang) => <option key={gudang.id} value={gudang.id}>{gudang.nama}</option>)}
            </select>
            <button className="tombol tombol--primer" style={{ width: 'auto', padding: '0 20px' }} onClick={muatBelanja} disabled={loadingBelanja}>
              {loadingBelanja ? <span className="spinner" /> : 'Muat laporan'}
            </button>
            <button className="tombol tombol--sekunder" style={{ width: 'auto', padding: '0 20px' }} onClick={downloadBelanja} disabled={downloadingBelanja}>
              {downloadingBelanja ? <span className="spinner" /> : '⬇ Excel'}
            </button>
          </div>

          {belanjaData && (
            <>
              <div className="kartu" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>Total belanja {belanjaData.periode}</div>
                <div style={{ fontFamily: 'var(--font-angka)', fontSize: 24, fontWeight: 700, color: 'var(--warna-arang)', marginTop: 4 }}>
                  Rp {Number(belanjaData.ringkasan.totalBelanja).toLocaleString('id-ID')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 6 }}>
                  {belanjaData.ringkasan.jumlahNota} nota · {belanjaData.ringkasan.jumlahBaris} baris barang
                  {belanjaData.ringkasan.jumlahBarisTanpaHarga > 0 && ` · ${belanjaData.ringkasan.jumlahBarisTanpaHarga} baris tanpa harga`}
                </div>
              </div>

              {belanjaData.perPemasok.length === 0 ? (
                <p style={{ color: 'var(--warna-abu)', fontSize: 14 }}>Tidak ada penerimaan terverifikasi pada periode ini.</p>
              ) : belanjaData.perPemasok.map((row) => (
                <div key={row.pemasok} className="kartu" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{row.pemasok}</div>
                    <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 3 }}>
                      {row.jumlahNota} nota · {row.jumlahBaris} baris barang
                      {row.jumlahBarisTanpaHarga > 0 && ` · ${row.jumlahBarisTanpaHarga} tanpa harga`}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-angka)', fontWeight: 700, whiteSpace: 'nowrap', alignSelf: 'center' }}>
                    Rp {Number(row.totalBelanja).toLocaleString('id-ID')}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
