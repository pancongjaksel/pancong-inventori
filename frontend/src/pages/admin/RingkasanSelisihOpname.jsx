import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

const rupiah = (nilai) => `Rp ${Number(nilai || 0).toLocaleString('id-ID')}`;
function periodeAwal() {
  const now = new Date();
  const year = now.getFullYear(); const month = now.getMonth() + 1;
  const target = now.getDate() <= 3 ? new Date(year, month - 2, 1) : new Date(year, month - 1, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
}

export default function RingkasanSelisihOpname() {
  const [periode, setPeriode] = useState(periodeAwal);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function muat() {
    setLoading(true); setError('');
    try { setData(await api.get(`/stok-opname/ringkasan-selisih?periode=${periode}`)); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Gagal memuat ringkasan selisih.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { muat(); }, []);

  return <div>
    <h1 className="judul-halaman">Ringkasan Selisih Closing</h1>
    <div className="kartu" style={{ marginBottom: 16 }}>
      <label className="label" htmlFor="periode-selisih">Periode closing</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input id="periode-selisih" type="month" className="input-teks" value={periode} onChange={e => setPeriode(e.target.value)} style={{ maxWidth: 220 }} />
        <button className="tombol tombol--primer" onClick={muat} disabled={loading} style={{ width: 'auto', padding: '0 18px' }}>Muat ringkasan</button>
      </div>
    </div>
    {error && <div className="pesan-error">{error}</div>}
    {loading && <p style={{ color: 'var(--warna-abu)' }}>Memuat...</p>}
    {!loading && data && <>
      <section className="kartu" style={{ marginBottom: 16, border: '1.5px solid #e6c394' }}>
        <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>Selisih Gudang — potensi lost</h2>
        <p style={{ fontSize: 13, color: 'var(--warna-abu)', marginTop: 0 }}>Positif berarti stok sistem lebih tinggi dari hitungan fisik. Nilai memakai harga master item saat ini.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12, fontSize: 13 }}>
          <span><strong>Potensi lost:</strong> {rupiah(data.gudang.ringkasan.potensi_lost)}</span>
          <span><strong>Kelebihan fisik:</strong> {rupiah(data.gudang.ringkasan.kelebihan_fisik)}</span>
          <span><strong>Total nilai selisih:</strong> {rupiah(data.gudang.ringkasan.total_nilai_selisih)}</span>
        </div>
        <TabelGudang items={data.gudang.items} />
      </section>
      <section className="kartu">
        <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>Opname Outlet — pemakaian tercatat</h2>
        <p style={{ fontSize: 13, color: 'var(--warna-abu)', marginTop: 0 }}>Ini adalah HPP pemakaian dari stok awal + pengambilan − stok akhir; bukan otomatis kehilangan barang.</p>
        <div style={{ fontSize: 13, marginBottom: 12 }}><strong>Total HPP pemakaian:</strong> {rupiah(data.outlet.ringkasan.total_hpp)}</div>
        <TabelOutlet items={data.outlet.items} />
      </section>
    </>}
  </div>;
}

function Empty({ children }) { return <p style={{ color: 'var(--warna-abu)', fontSize: 13 }}>{children}</p>; }
function TabelGudang({ items }) {
  if (!items.length) return <Empty>Tidak ada selisih gudang pada periode ini.</Empty>;
  return <>
    <div className="selisih-closing__desktop"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><thead><tr style={{ textAlign: 'left', color: 'var(--warna-abu)' }}><th>Gudang</th><th>Item</th><th style={{ textAlign: 'right' }}>Sistem</th><th style={{ textAlign: 'right' }}>Fisik</th><th style={{ textAlign: 'right' }}>Selisih</th><th style={{ textAlign: 'right' }}>Nilai</th></tr></thead><tbody>{items.map(x => <tr key={`${x.sesi_id}-${x.kode_barang}`} style={{ borderTop: '1px solid var(--warna-garis)' }}><td>{x.nama_lokasi}</td><td>{x.nama_item}<div style={{ color: 'var(--warna-abu)' }}>{x.satuan}</div></td><td style={{ textAlign: 'right' }}>{x.stok_sistem}</td><td style={{ textAlign: 'right' }}>{x.stok_fisik}</td><td style={{ textAlign: 'right', color: Number(x.selisih) > 0 ? 'var(--warna-bahaya)' : 'var(--warna-sukses)', fontWeight: 700 }}>{Number(x.selisih) > 0 ? '-' : '+'}{Math.abs(Number(x.selisih))}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{rupiah(x.nilai_selisih)}</td></tr>)}</tbody></table></div>
    <div className="selisih-closing__mobile">{items.map(x => <article key={`${x.sesi_id}-${x.kode_barang}`} className="selisih-closing__card"><div className="selisih-closing__lokasi">{x.nama_lokasi}</div><div style={{ fontWeight: 700 }}>{x.nama_item} <span style={{ color: 'var(--warna-abu)', fontWeight: 400 }}>{x.satuan}</span></div><div className="selisih-closing__angka"><span>Sistem <strong>{x.stok_sistem}</strong></span><span>Fisik <strong>{x.stok_fisik}</strong></span><span>Selisih <strong style={{ color: Number(x.selisih) > 0 ? 'var(--warna-bahaya)' : 'var(--warna-sukses)' }}>{Number(x.selisih) > 0 ? '-' : '+'}{Math.abs(Number(x.selisih))}</strong></span></div><div className="selisih-closing__nilai">{rupiah(x.nilai_selisih)}</div></article>)}</div>
  </>;
}
function TabelOutlet({ items }) {
  if (!items.length) return <Empty>Belum ada pemakaian outlet pada periode ini.</Empty>;
  return <>
    <div className="selisih-closing__desktop"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><thead><tr style={{ textAlign: 'left', color: 'var(--warna-abu)' }}><th>Outlet</th><th>Item</th><th style={{ textAlign: 'right' }}>Awal</th><th style={{ textAlign: 'right' }}>Diambil</th><th style={{ textAlign: 'right' }}>Akhir</th><th style={{ textAlign: 'right' }}>Pakai</th><th style={{ textAlign: 'right' }}>HPP</th></tr></thead><tbody>{items.map(x => <tr key={`${x.sesi_id}-${x.kode_barang}`} style={{ borderTop: '1px solid var(--warna-garis)' }}><td>{x.nama_lokasi}</td><td>{x.nama_item}<div style={{ color: 'var(--warna-abu)' }}>{x.satuan}</div></td><td style={{ textAlign: 'right' }}>{x.stok_awal}</td><td style={{ textAlign: 'right' }}>{x.pengambilan}</td><td style={{ textAlign: 'right' }}>{x.stok_akhir ?? 0}</td><td style={{ textAlign: 'right' }}>{x.pemakaian}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{rupiah(x.nilai_pemakaian)}</td></tr>)}</tbody></table></div>
    <div className="selisih-closing__mobile">{items.map(x => <article key={`${x.sesi_id}-${x.kode_barang}`} className="selisih-closing__card"><div className="selisih-closing__lokasi">{x.nama_lokasi}</div><div style={{ fontWeight: 700 }}>{x.nama_item} <span style={{ color: 'var(--warna-abu)', fontWeight: 400 }}>{x.satuan}</span></div><div className="selisih-closing__angka"><span>Awal <strong>{x.stok_awal}</strong></span><span>Ambil <strong>{x.pengambilan}</strong></span><span>Akhir <strong>{x.stok_akhir ?? 0}</strong></span><span>Pakai <strong>{x.pemakaian}</strong></span></div><div className="selisih-closing__nilai">{rupiah(x.nilai_pemakaian)}</div></article>)}</div>
  </>;
}
