import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, ApiError } from '../../api/client';

export default function StokSaatIni() {
  const [data, setData] = useState([]);
  const [gudangs, setGudangs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gudangFilter, setGudangFilter] = useState('semua');
  const [search, setSearch] = useState('');

  // Baris mana aja yang lagi expanded di mode kartu mobile. Murni UI state,
  // gak nyentuh fetch/filter — kunci-nya sama kayak `key` di <tr> (gudang_id-item_id).
  const [barisTerbuka, setBarisTerbuka] = useState(() => new Set());

  useEffect(() => {
    api.get('/master/gudangs').then((list) => setGudangs(list || [])).catch(() => {});
  }, []);

  const muatData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const path = gudangFilter === 'semua'
        ? '/laporan/stok-saat-ini'
        : `/laporan/stok-saat-ini?gudang_id=${gudangFilter}`;
      const hasil = await api.get(path);
      setData(Array.isArray(hasil) ? hasil : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data stok saat ini.');
    } finally {
      setLoading(false);
    }
  }, [gudangFilter]);

  useEffect(() => {
    muatData();
  }, [muatData]);

  const dataTersaring = useMemo(() => {
    const kataKunci = search.trim().toLowerCase();
    if (!kataKunci) return data;
    return data.filter((r) => r.nama_item.toLowerCase().includes(kataKunci));
  }, [data, search]);

  const ringkasan = useMemo(() => ({
    total: dataTersaring.length,
    menipis: dataTersaring.filter((r) => r.stok_menipis).length,
    negatif: dataTersaring.filter((r) => r.stok_negatif).length,
  }), [dataTersaring]);

  const formatStok = (nilai) => {
    const angka = Number(nilai);
    return Number.isFinite(angka) ? angka.toLocaleString('id-ID') : nilai;
  };

  function toggleBaris(kunci) {
    setBarisTerbuka((prev) => {
      const next = new Set(prev);
      if (next.has(kunci)) next.delete(kunci);
      else next.add(kunci);
      return next;
    });
  }

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Stok Saat Ini</h1>
      <p style={{ color: 'var(--warna-abu)', marginTop: 0, marginBottom: 20 }}>
        Live dari ledger stok — otomatis update tiap ada transaksi barang masuk/keluar.
      </p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="kartu" style={{ flex: '1 1 180px', padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Total Item</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{ringkasan.total}</div>
        </div>
        <div className="kartu" style={{ flex: '1 1 180px', padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Stok Menipis</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--warna-karamel)' }}>
            {ringkasan.menipis}
          </div>
        </div>
        <div className="kartu" style={{ flex: '1 1 180px', padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Stok Negatif</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--warna-bahaya)' }}>
            {ringkasan.negatif}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          className="input-teks"
          value={gudangFilter}
          onChange={(e) => setGudangFilter(e.target.value)}
          style={{ width: 'auto', padding: '8px 12px' }}
        >
          <option value="semua">Semua Gudang</option>
          {gudangs.map((g) => (
            <option key={g.id} value={g.id}>{g.nama}</option>
          ))}
        </select>
        <input
          type="text"
          className="input-teks"
          placeholder="Cari nama item..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 220px' }}
        />
      </div>

      {loading && <p>Memuat data...</p>}
      {error && <div className="pesan-error">{error}</div>}

      {!loading && !error && (
        <div className="kartu stok-tabel-wrapper" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="stok-tabel" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--warna-garis)' }}>
                <th style={{ padding: '10px 14px' }}>Gudang</th>
                <th style={{ padding: '10px 14px' }}>Kode</th>
                <th style={{ padding: '10px 14px' }}>Nama Item</th>
                <th style={{ padding: '10px 14px' }}>Satuan</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Stok Saat Ini</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Reorder Point</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {dataTersaring.map((r) => {
                const warnaBaris = r.stok_negatif
                  ? 'rgba(178, 58, 52, 0.08)'
                  : r.stok_menipis
                  ? 'rgba(184, 114, 46, 0.08)'
                  : 'white';
                const kunciBaris = `${r.gudang_id}-${r.item_id}`;
                const isTerbuka = barisTerbuka.has(kunciBaris);
                return (
                  <tr
                    key={kunciBaris}
                    className={isTerbuka ? 'baris-terbuka' : undefined}
                    style={{ borderBottom: '1px solid var(--warna-garis)', background: warnaBaris }}
                  >
                    <td data-label="Gudang" style={{ padding: '10px 14px' }}>{r.nama_gudang}</td>
                    <td data-label="Kode" style={{ padding: '10px 14px' }}>{r.kode_barang}</td>
                    <td data-label="Nama Item" style={{ padding: '10px 14px' }}>
                      <button
                        type="button"
                        className="stok-tabel__toggle"
                        onClick={() => toggleBaris(kunciBaris)}
                        aria-expanded={isTerbuka}
                      >
                        <span>{r.nama_item}</span>
                        <IkonChevron />
                      </button>
                    </td>
                    <td data-label="Satuan" style={{ padding: '10px 14px' }}>{r.satuan}</td>
                    <td
                      data-label="Stok Saat Ini"
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: r.stok_negatif
                          ? 'var(--warna-bahaya)'
                          : r.stok_menipis
                          ? 'var(--warna-karamel)'
                          : 'inherit',
                      }}
                    >
                      {formatStok(r.stok_saat_ini)}
                    </td>
                    <td data-label="Reorder Point" style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--warna-abu)' }}>
                      {r.reorder_point ?? '-'}
                    </td>
                    <td data-label="Status" style={{ padding: '10px 14px' }}>
                      {r.stok_negatif ? (
                        <span className="stok-badge stok-badge--negatif">Negatif</span>
                      ) : r.stok_menipis ? (
                        <span className="stok-badge stok-badge--menipis">Menipis</span>
                      ) : (
                        <span className="stok-badge stok-badge--aman">Aman</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {dataTersaring.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--warna-abu)' }}>
                    Tidak ada item yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IkonChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
