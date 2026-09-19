import { useState, useEffect } from 'react';
import { api, ApiError } from '../../api/client';

export default function HppOutlet() {
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState('');
  const [riwayat, setRiwayat] = useState([]);
  const [opnameId, setOpnameId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/opname-outlet/outlets').then(d => setOutlets(d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!outletId) { setRiwayat([]); setOpnameId(''); setData(null); return; }
    api.get(`/opname-outlet/riwayat/${outletId}`)
      .then(d => setRiwayat(d || []))
      .catch(() => setRiwayat([]));
  }, [outletId]);

  useEffect(() => {
    if (!opnameId) { setData(null); return; }
    setLoading(true); setError('');
    api.get(`/opname-outlet/laporan?opname_id=${opnameId}`)
      .then(d => setData(d))
      .catch(err => setError(err instanceof ApiError ? err.message : 'Gagal memuat laporan.'))
      .finally(() => setLoading(false));
  }, [opnameId]);

  const formatRupiah = (nilai) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nilai ?? 0);

  const groupByKategori = (items) => {
    const map = {};
    items.forEach(item => {
      if (!map[item.kategori]) map[item.kategori] = [];
      map[item.kategori].push(item);
    });
    return map;
  };

  return (
    <div>
      <div className="riwayat-filter" style={{ gap: 8 }}>
        <select
          className="input-teks"
          value={outletId}
          onChange={e => { setOutletId(e.target.value); setOpnameId(''); setData(null); }}
          style={{ width: 'auto', padding: '0 12px' }}
        >
          <option value="">Pilih outlet</option>
          {outlets.map(o => <option key={o.id} value={o.id}>{o.nama}</option>)}
        </select>

        {riwayat.length > 0 && (
          <select
            className="input-teks"
            value={opnameId}
            onChange={e => setOpnameId(e.target.value)}
            style={{ width: 'auto', padding: '0 12px' }}
          >
            <option value="">Pilih periode opname</option>
            {riwayat.map(op => (
              <option key={op.id} value={op.id}>
                {op.tanggal_opname?.slice(0, 10)} · {op.periode_dari?.slice(0, 10)} s/d {op.periode_sampai?.slice(0, 10)}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="pesan-error" style={{ marginTop: 8 }}>{error}</div>}
      {loading && <p style={{ fontSize: 14, color: 'var(--warna-abu)', marginTop: 12 }}>Memuat laporan...</p>}

      {!outletId && !error && (
        <p style={{ color: 'var(--warna-abu)', fontSize: 14, marginTop: 12 }}>Pilih outlet dulu buat lihat laporan HPP.</p>
      )}
      {outletId && !opnameId && !loading && riwayat.length === 0 && (
        <p style={{ color: 'var(--warna-abu)', fontSize: 14, marginTop: 12 }}>Belum ada opname untuk outlet ini.</p>
      )}
      {outletId && !opnameId && !loading && riwayat.length > 0 && (
        <p style={{ color: 'var(--warna-abu)', fontSize: 14, marginTop: 12 }}>Pilih periode opname untuk lihat HPP-nya.</p>
      )}

      {data && !loading && (
        <div style={{ marginTop: 16 }}>
          <p className="label">
            {data.nama_outlet} · {data.tanggal_opname?.slice(0, 10)}
          </p>
          <p style={{ fontSize: 12, color: 'var(--warna-abu)', marginBottom: 12 }}>
            Periode {data.periode_dari?.slice(0, 10)} s/d {data.periode_sampai?.slice(0, 10)} · oleh {data.dibuat_oleh}
          </p>

          {Object.entries(groupByKategori(data.items)).map(([kategori, itemList]) => {
            const subtotalKategori = itemList.reduce((sum, i) => sum + Number(i.hpp || 0), 0);
            return (
              <div key={kategori} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  {kategori}
                </div>
                {itemList.map(item => (
                  <div key={item.kode_barang} className="kartu" style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{item.nama}</div>
                        <div style={{ fontSize: 11, color: 'var(--warna-abu)' }}>
                          Awal {item.stok_awal} + Ambil {item.pengambilan} − Akhir {item.stok_akhir ?? '?'} = Pakai {item.pemakaian}
                        </div>
                        {item.catatan && (
                          <div style={{ fontSize: 11, color: 'var(--warna-abu)', fontStyle: 'italic' }}>{item.catatan}</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 90 }}>
                        <div style={{ fontSize: 11, color: 'var(--warna-abu)' }}>{formatRupiah(item.harga)} / {item.satuan}</div>
                        <div style={{ fontFamily: 'var(--font-angka)', fontWeight: 700, color: 'var(--warna-karamel)' }}>
                          {formatRupiah(item.hpp)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--warna-abu)', marginTop: 2 }}>
                  Subtotal {kategori}: <strong>{formatRupiah(subtotalKategori)}</strong>
                </div>
              </div>
            );
          })}

          <div style={{ borderTop: '2px solid var(--warna-garis)', paddingTop: 12, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>Total HPP</span>
            <span style={{ fontFamily: 'var(--font-angka)', fontWeight: 700, fontSize: 18, color: 'var(--warna-karamel)' }}>
              {formatRupiah(data.total_hpp)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
