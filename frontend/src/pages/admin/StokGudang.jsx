import { useEffect, useState, useMemo } from 'react';
import { api, ApiError } from '../../api/client';

export default function StokGudang() {
  const [stokGudang, setStokGudang] = useState([]);
  const [stokMenipis, setStokMenipis] = useState([]);
  const [gudangDipilih, setGudangDipilih] = useState('semua');
  const [cari, setCari] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/laporan/stok-gudang'), api.get('/laporan/stok-menipis')])
      .then(([gudang, menipis]) => {
        setStokGudang(gudang);
        setStokMenipis(menipis);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }, []);

  const daftarGudang = useMemo(() => [...new Set(stokGudang.map((r) => r.nama_gudang))], [stokGudang]);

  const stokTampil = useMemo(() => {
    let hasil = stokGudang;
    if (gudangDipilih !== 'semua') {
      hasil = hasil.filter((r) => r.nama_gudang === gudangDipilih);
    } else {
      // Agregasi per item lintas semua gudang
      const agg = new Map();
      hasil.forEach((r) => {
        if (!agg.has(r.item_id)) {
          agg.set(r.item_id, { ...r, stok_saat_ini: Number(r.stok_saat_ini), gudang_id: null, nama_gudang: null });
        } else {
          agg.get(r.item_id).stok_saat_ini += Number(r.stok_saat_ini);
        }
      });
      hasil = [...agg.values()];
    }
    if (cari.trim()) {
      const kunci = cari.trim().toLowerCase();
      hasil = hasil.filter((r) =>
        r.nama_item.toLowerCase().includes(kunci) ||
        r.kode_barang.toLowerCase().includes(kunci)
      );
    }
    return hasil;
  }, [stokGudang, gudangDipilih, cari]);

  const menipisSet = useMemo(() => new Set(
    stokMenipis.map((r) => `${r.gudang_id}-${r.item_id}`)
  ), [stokMenipis]);

  const menipisItemSet = useMemo(() => new Set(
    stokMenipis.map((r) => r.item_id)
  ), [stokMenipis]);

  const jumlahMenipis = useMemo(() => {
    if (gudangDipilih === 'semua') return stokMenipis.length;
    return stokMenipis.filter((r) => r.nama_gudang === gudangDipilih).length;
  }, [gudangDipilih, stokMenipis]);

  function statusStok(r) {
    if (gudangDipilih === 'semua') {
      if (Number(r.stok_saat_ini) === 0) return 'habis';
      if (menipisItemSet.has(r.item_id)) return 'menipis';
      return 'normal';
    }
    const key = `${r.gudang_id}-${r.item_id}`;
    if (!menipisSet.has(key)) return 'normal';
    if (Number(r.stok_saat_ini) === 0) return 'habis';
    return 'menipis';
  }

  if (loading) return (
    <div style={{ padding: 20, color: 'var(--warna-abu)', fontSize: 14 }}>Memuat...</div>
  );

  return (
    <div>
      {error && <div className="pesan-error" style={{ margin: '0 16px 12px' }}>{error}</div>}

      {/* Search */}
      <div style={{ padding: '14px 16px 8px' }}>
        <input
          className="input-teks"
          type="search"
          placeholder="Cari item atau kode barang..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          style={{ height: 44, fontSize: 14 }}
        />
      </div>

      {/* Filter gudang */}
      <div style={{ padding: '4px 16px 12px' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          <TabChip label="Semua" aktif={gudangDipilih === 'semua'} onClick={() => setGudangDipilih('semua')} />
          {daftarGudang.map((nama) => (
            <TabChip key={nama} label={nama} aktif={gudangDipilih === nama} onClick={() => setGudangDipilih(nama)} />
          ))}
        </div>
      </div>

      {/* Summary bar */}
      <div style={{
        padding: '8px 16px',
        background: 'var(--warna-krim-redup)',
        borderTop: '1px solid var(--warna-garis)',
        borderBottom: '1px solid var(--warna-garis)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 12, color: 'var(--warna-abu)' }}>
          {stokTampil.length} item
        </span>
        {jumlahMenipis > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--warna-bahaya)' }}>
            {jumlahMenipis} menipis
          </span>
        )}
      </div>

      {/* List stok */}
      <div style={{ margin: '0 16px', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--warna-garis)' }}>
        {stokTampil.map((r, i) => {
          const status = statusStok(r);
          const modeSemua = gudangDipilih === 'semua';
          const menipis = modeSemua
            ? null
            : stokMenipis.find((m) => m.item_id === r.item_id && m.gudang_id === r.gudang_id);

          return (
            <div
              key={modeSemua ? `semua-${r.item_id}` : `${r.gudang_id}-${r.item_id}`}
              style={{
                background: status === 'habis' ? '#FEF8F8' : status === 'menipis' ? '#FFFBF5' : 'white',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: i < stokTampil.length - 1 ? '1px solid var(--warna-garis)' : 'none',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--warna-arang)', marginBottom: 1 }}>
                  {r.nama_item}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {!modeSemua && (
                    <>
                      <span style={{ fontSize: 11, color: 'var(--warna-abu)' }}>{r.nama_gudang}</span>
                      <span style={{ fontSize: 11, color: 'var(--warna-garis)' }}>·</span>
                    </>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--warna-abu)', fontFamily: 'var(--font-angka)' }}>{r.kode_barang}</span>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                <div style={{
                  fontFamily: 'var(--font-angka)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: status === 'habis' ? 'var(--warna-bahaya)' : 'var(--warna-arang)',
                }}>
                  {Number(r.stok_saat_ini).toLocaleString('id-ID')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--warna-abu)' }}>{r.satuan}</div>
                {status === 'habis' && (
                  <Chip label="Habis" warna="bahaya" />
                )}
                {status === 'menipis' && (
                  <Chip label={menipis ? `min ${menipis.reorder_point}` : 'Menipis'} warna="peringatan" />
                )}
              </div>
            </div>
          );
        })}

        {stokTampil.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14, background: 'white' }}>
            {cari ? `Tidak ada item yang cocok dengan "${cari}"` : 'Tidak ada data stok.'}
          </div>
        )}
      </div>

      <div style={{ height: 100 }} />
    </div>
  );
}

function TabChip({ label, aktif, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 20,
        border: aktif ? 'none' : '1.5px solid var(--warna-garis)',
        background: aktif ? 'var(--warna-arang)' : 'white',
        color: aktif ? 'white' : 'var(--warna-abu)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function Chip({ label, warna }) {
  const styles = {
    bahaya: { background: '#FBEAE9', color: 'var(--warna-bahaya)' },
    peringatan: { background: '#FDF0E0', color: '#7A5420' },
  };
  return (
    <div style={{
      display: 'inline-block',
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 6px',
      borderRadius: 5,
      marginTop: 3,
      ...styles[warna],
    }}>
      {label}
    </div>
  );
}
