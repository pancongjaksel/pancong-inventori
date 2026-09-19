import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

const BASE = '/opname-outlet';

export default function OpnameOutletCrew() {
  const navigate = useNavigate();

  // Step: 'pilih-outlet' | 'isi-opname' | 'review' | 'selesai'
  const [step, setStep] = useState('pilih-outlet');

  const [outlets, setOutlets] = useState([]);
  const [outletDipilih, setOutletDipilih] = useState(null);
  const [items, setItems] = useState([]);
  const [stokAwal, setStokAwal] = useState({}); // { [item_id]: number }
  const [pengambilan, setPengambilan] = useState({}); // { [item_id]: number }
  const [fisik, setFisik] = useState({}); // { [item_id]: string }
  const [filter, setFilter] = useState('semua'); // 'semua'|'belum'|'minus'|'surplus'
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  const [opnameIdBaru, setOpnameIdBaru] = useState(null);

  // Periode: bulan ini
  const sekarang = new Date();
  const periodeLabel = sekarang.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const periodeDari = new Date(sekarang.getFullYear(), sekarang.getMonth(), 1)
    .toISOString().slice(0, 10);
  const periodeSampai = sekarang.toISOString().slice(0, 10);

  // Load outlets
  useEffect(() => {
    api.get(`${BASE}/outlets`, { auth: 'device' })
      .then(setOutlets)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat outlet.'));
  }, []);

  // Load items + stok awal + pengambilan setelah outlet dipilih
  useEffect(() => {
    if (!outletDipilih) return;
    setLoadingData(true);
    setError(null);

    Promise.all([
      api.get(`${BASE}/items`, { auth: 'device' }),
      api.get(`${BASE}/pengambilan-preview?outlet_id=${outletDipilih.id}&dari=${periodeDari}&sampai=${periodeSampai}`, { auth: 'device' }),
    ])
      .then(async ([itemList, pengambilanData]) => {
        setItems(itemList);

        // Pengambilan per item_id
        const peta = {};
        pengambilanData.forEach((r) => { peta[r.item_id] = Number(r.total_diambil ?? 0); });
        setPengambilan(peta);

        // Stok awal per item
        const stokMap = {};
        await Promise.all(
          itemList.map((item) =>
            api.get(`${BASE}/stok-awal/${outletDipilih.id}/${item.id}`, { auth: 'device' })
              .then((r) => { stokMap[item.id] = Number(r.stok_akhir ?? 0); })
              .catch(() => { stokMap[item.id] = 0; })
          )
        );
        setStokAwal(stokMap);
        setFisik({});
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data item.'))
      .finally(() => setLoadingData(false));
  }, [outletDipilih]);

  // Hitung selisih per item
  function selisihItem(itemId) {
    const f = fisik[itemId];
    if (f === undefined || f === '') return null;
    const awal = stokAwal[itemId] ?? 0;
    const ambil = pengambilan[itemId] ?? 0;
    const sistemHitung = awal + ambil;
    return Number(f) - sistemHitung;
  }

  function sistemItem(itemId) {
    return (stokAwal[itemId] ?? 0) + (pengambilan[itemId] ?? 0);
  }

  const itemsTampil = useMemo(() => {
    if (filter === 'semua') return items;
    if (filter === 'belum') return items.filter((i) => fisik[i.id] === undefined || fisik[i.id] === '');
    if (filter === 'minus') return items.filter((i) => {
      const s = selisihItem(i.id);
      return s !== null && s < 0;
    });
    if (filter === 'surplus') return items.filter((i) => {
      const s = selisihItem(i.id);
      return s !== null && s > 0;
    });
    return items;
  }, [items, fisik, filter]);

  const jumlahBelum = items.filter((i) => fisik[i.id] === undefined || fisik[i.id] === '').length;
  const jumlahMinus = items.filter((i) => { const s = selisihItem(i.id); return s !== null && s < 0; }).length;
  const jumlahSurplus = items.filter((i) => { const s = selisihItem(i.id); return s !== null && s > 0; }).length;

  async function handleSubmit() {
    if (jumlahBelum > 0) {
      setError(`Masih ada ${jumlahBelum} item belum diisi.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const itemsPayload = items.map((item) => ({
        item_id: item.id,
        stok_awal: stokAwal[item.id] ?? 0,
        pengambilan: pengambilan[item.id] ?? 0,
        stok_fisik: Number(fisik[item.id]),
        selisih: selisihItem(item.id),
      }));

      const hasil = await api.post(BASE, {
        outlet_id: outletDipilih.id,
        tanggal_opname: periodeSampai,
        periode_dari: periodeDari,
        periode_sampai: periodeSampai,
        items: itemsPayload,
      }, { auth: 'device' });

      setOpnameIdBaru(hasil.id);
      setStep('selesai');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan opname.');
    } finally {
      setLoading(false);
    }
  }

  // ─── STEP: Pilih Outlet ───────────────────────────────────────────
  if (step === 'pilih-outlet') {
    return (
      <div className="mobile-page">
        <div className="mobile-page__content">
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warna-arang)', marginBottom: 4 }}>
              Opname Outlet
            </div>
            <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>{periodeLabel}</div>
          </div>

          {error && <div className="pesan-error">{error}</div>}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Pilih outlet
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {outlets.map((outlet) => (
              <button
                key={outlet.id}
                onClick={() => { setOutletDipilih(outlet); setStep('isi-opname'); }}
                style={{
                  background: 'white',
                  border: '1px solid var(--warna-garis)',
                  borderRadius: 12,
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--warna-arang)' }}>{outlet.nama}</div>
                  {outlet.alamat && (
                    <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 2 }}>{outlet.alamat}</div>
                  )}
                </div>
                <span style={{ fontSize: 20, color: 'var(--warna-abu)' }}>›</span>
              </button>
            ))}
            {outlets.length === 0 && !error && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--warna-abu)', fontSize: 14 }}>
                Tidak ada outlet aktif.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP: Isi Opname ─────────────────────────────────────────────
  if (step === 'isi-opname') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Sub-header konteks */}
        <div style={{
          background: 'var(--warna-arang)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <button
            onClick={() => { setStep('pilih-outlet'); setOutletDipilih(null); }}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 36, height: 36, color: 'white', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}
          >
            ‹
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>{outletDipilih?.nama}</div>
            <div style={{ color: '#c0b4a8', fontSize: 11, marginTop: 1 }}>{periodeLabel}</div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.12)',
            color: '#e8ddd5',
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 6,
          }}>
            {items.length - jumlahBelum}/{items.length}
          </div>
        </div>

        {/* Filter chips */}
        <div style={{
          padding: '10px 16px',
          background: 'white',
          borderBottom: '1px solid var(--warna-garis)',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {[
            { key: 'semua', label: `Semua (${items.length})` },
            { key: 'belum', label: `Belum (${jumlahBelum})` },
            { key: 'minus', label: `Minus (${jumlahMinus})` },
            { key: 'surplus', label: `Surplus (${jumlahSurplus})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '6px 12px',
                borderRadius: 16,
                border: filter === key ? 'none' : '1.5px solid var(--warna-garis)',
                background: filter === key ? 'var(--warna-arang)' : 'white',
                color: filter === key ? 'white' : 'var(--warna-abu)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <div className="pesan-error" style={{ margin: '12px 16px 0' }}>{error}</div>}

        {loadingData ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>
            Memuat data item...
          </div>
        ) : (
          <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 140 }}>
            {itemsTampil.map((item) => {
              const s = selisihItem(item.id);
              const sistem = sistemItem(item.id);
              const belumDiisi = fisik[item.id] === undefined || fisik[item.id] === '';

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'white',
                    border: `1px solid ${s !== null && s < 0 ? '#F0C070' : s !== null && s > 0 ? '#A8D5B5' : belumDiisi ? 'var(--warna-garis)' : 'var(--warna-garis)'}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                    opacity: belumDiisi ? 0.75 : 1,
                  }}
                >
                  {/* Header item */}
                  <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warna-arang)' }}>{item.nama}</div>
                      <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginTop: 1 }}>{item.satuan}</div>
                    </div>
                    {s !== null && (
                      <SelisihChip nilai={s} />
                    )}
                  </div>

                  {/* 3 kolom */}
                  <div style={{ padding: '0 14px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, alignItems: 'end' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                        Sistem
                      </div>
                      <div style={{ fontFamily: 'var(--font-angka)', fontSize: 16, fontWeight: 700, color: 'var(--warna-arang)' }}>
                        {sistem.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                        Fisik
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={fisik[item.id] ?? ''}
                        onChange={(e) => {
                          setFisik((prev) => ({ ...prev, [item.id]: e.target.value }));
                          if (error) setError(null);
                        }}
                        placeholder="—"
                        style={{
                          width: '100%',
                          height: 44,
                          borderRadius: 9,
                          border: `2px solid ${belumDiisi ? 'var(--warna-garis)' : 'var(--warna-karamel)'}`,
                          background: 'white',
                          color: 'var(--warna-arang)',
                          fontFamily: 'var(--font-angka)',
                          fontSize: 18,
                          fontWeight: 700,
                          textAlign: 'center',
                          outline: 'none',
                          padding: '0 8px',
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                        Selisih
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-angka)',
                        fontSize: 16,
                        fontWeight: 700,
                        color: s === null ? 'var(--warna-garis)' : s < 0 ? 'var(--warna-bahaya)' : s > 0 ? 'var(--warna-sukses)' : 'var(--warna-abu)',
                      }}>
                        {s === null ? '—' : s > 0 ? `+${s.toLocaleString('id-ID')}` : s.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {itemsTampil.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--warna-abu)', fontSize: 14 }}>
                Tidak ada item di filter ini.
              </div>
            )}
          </div>
        )}

        {/* Tombol sticky bawah */}
        <div style={{
          position: 'sticky',
          bottom: 0,
          padding: '12px 16px calc(12px + 10px)',
          background: 'linear-gradient(to top, var(--warna-krim) 70%, transparent)',
        }}>
          {jumlahBelum > 0 && (
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--warna-abu)', marginBottom: 8 }}>
              {jumlahBelum} item belum diisi
            </div>
          )}
          <button
            onClick={() => { setFilter('semua'); setStep('review'); }}
            disabled={items.length === 0}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 12,
              border: 'none',
              background: jumlahBelum > 0 ? 'var(--warna-abu)' : 'var(--warna-karamel)',
              color: 'white',
              fontSize: 15,
              fontWeight: 700,
              cursor: jumlahBelum > 0 ? 'default' : 'pointer',
            }}
          >
            {jumlahBelum > 0 ? `Isi dulu ${jumlahBelum} item` : 'Review Opname →'}
          </button>
        </div>
      </div>
    );
  }

  // ─── STEP: Review ─────────────────────────────────────────────────
  if (step === 'review') {
    const itemsAdaSelisih = items.filter((i) => {
      const s = selisihItem(i.id);
      return s !== null && s !== 0;
    });
    const itemsOke = items.filter((i) => selisihItem(i.id) === 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ background: 'var(--warna-arang)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setStep('isi-opname')}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 36, height: 36, color: 'white', fontSize: 20, cursor: 'pointer' }}
          >
            ‹
          </button>
          <div>
            <div style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>Review Opname</div>
            <div style={{ color: '#c0b4a8', fontSize: 11, marginTop: 1 }}>{outletDipilih?.nama} · {periodeLabel}</div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '16px', paddingBottom: 140 }}>
          {error && <div className="pesan-error">{error}</div>}

          {/* Ringkasan */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            <StatCard label="Total item" nilai={items.length} />
            <StatCard label="Ada selisih" nilai={itemsAdaSelisih.length} warna={itemsAdaSelisih.length > 0 ? 'var(--warna-bahaya)' : undefined} />
            <StatCard label="Minus" nilai={jumlahMinus} warna={jumlahMinus > 0 ? 'var(--warna-bahaya)' : undefined} />
            <StatCard label="Surplus" nilai={jumlahSurplus} warna={jumlahSurplus > 0 ? 'var(--warna-sukses)' : undefined} />
          </div>

          {/* Item yang ada selisih */}
          {itemsAdaSelisih.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Perlu perhatian ({itemsAdaSelisih.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {itemsAdaSelisih.map((item) => {
                  const s = selisihItem(item.id);
                  return (
                    <div key={item.id} style={{
                      background: 'white',
                      border: '1px solid var(--warna-garis)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warna-arang)' }}>{item.nama}</div>
                        <div style={{ fontSize: 11, color: 'var(--warna-abu)', fontFamily: 'var(--font-angka)', marginTop: 2 }}>
                          Sistem: {sistemItem(item.id)} → Fisik: {fisik[item.id]}
                        </div>
                      </div>
                      <SelisihChip nilai={s} />
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Item oke */}
          {itemsOke.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Sesuai ({itemsOke.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {itemsOke.map((item) => (
                  <div key={item.id} style={{
                    background: 'white',
                    border: '1px solid var(--warna-garis)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--warna-arang)' }}>{item.nama}</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-angka)', color: 'var(--warna-sukses)', fontWeight: 700 }}>✓ {fisik[item.id]}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ position: 'sticky', bottom: 0, padding: '12px 16px calc(12px + 10px)', background: 'linear-gradient(to top, var(--warna-krim) 70%, transparent)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => setStep('isi-opname')}
            style={{ width: '100%', height: 44, borderRadius: 12, border: '1.5px solid var(--warna-garis)', background: 'transparent', color: 'var(--warna-arang)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            ← Edit
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: '100%', height: 52, borderRadius: 12, border: 'none', background: 'var(--warna-karamel)', color: 'white', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Menyimpan...' : 'Kirim Opname →'}
          </button>
        </div>
      </div>
    );
  }

  // ─── STEP: Selesai ────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✓</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warna-arang)', marginBottom: 8 }}>
        Opname Terkirim
      </div>
      <div style={{ fontSize: 14, color: 'var(--warna-abu)', marginBottom: 32, lineHeight: 1.5 }}>
        Opname {outletDipilih?.nama} untuk {periodeLabel} sudah dikirim dan menunggu approval admin.
      </div>
      <button
        onClick={() => navigate('/crew')}
        style={{ height: 52, padding: '0 32px', borderRadius: 12, border: 'none', background: 'var(--warna-karamel)', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
      >
        Kembali ke Home
      </button>
    </div>
  );
}

function SelisihChip({ nilai }) {
  if (nilai === 0) return (
    <div style={{ background: 'var(--warna-krim-redup)', color: 'var(--warna-abu)', fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 8 }}>0</div>
  );
  return (
    <div style={{
      background: nilai < 0 ? '#FBEAE9' : '#E9F3ED',
      color: nilai < 0 ? 'var(--warna-bahaya)' : 'var(--warna-sukses)',
      fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 8,
      display: 'flex', alignItems: 'center', gap: 3,
    }}>
      {nilai < 0 ? '↓' : '↑'} {nilai > 0 ? '+' : ''}{nilai.toLocaleString('id-ID')}
    </div>
  );
}

function StatCard({ label, nilai, warna }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-angka)', fontSize: 22, fontWeight: 700, color: warna ?? 'var(--warna-arang)' }}>{nilai}</div>
    </div>
  );
}
