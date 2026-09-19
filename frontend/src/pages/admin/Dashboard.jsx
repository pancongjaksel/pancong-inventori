import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import ApprovalCenterCards from '../../components/ApprovalCenterCards';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatJam(iso) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function waktuRelatif(iso) {
  const detik = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return `${Math.floor(detik / 60)} mnt lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  return `${Math.floor(detik / 86400)} hari lalu`;
}

const JENIS_CFG = {
  pengambilan: { label: 'Pengambilan', warna: 'var(--warna-karamel)', prefix: '👤' },
  transfer:    { label: 'Pemindahan',  warna: '#2563eb',               prefix: '↗' },
  barang_masuk:{ label: 'Penerimaan', warna: 'var(--warna-sukses)',    prefix: '📦' },
  koreksi:     { label: 'Penyesuaian',warna: 'var(--warna-bahaya)',   prefix: '✎' },
};

function teksAktivitas(row) {
  const pelaku = row.pelaku || '-';
  const n = row.jumlah_item || 0;
  if (row.jenis === 'pengambilan') return `${pelaku} mengambil ${n} item`;
  if (row.jenis === 'transfer') return row.deskripsi_extra || `Transfer oleh ${pelaku}`;
  if (row.jenis === 'barang_masuk') return `Barang masuk ${n} item${row.deskripsi_extra ? ' · ' + row.deskripsi_extra : ''}`;
  if (row.jenis === 'koreksi') {
    const tabelLabel = {
      transaksi_masuk_nota: 'Penerimaan',
      sesi_pengambilan_crew: 'Pengambilan',
      transfer_gudang: 'Transfer',
    }[row.lokasi] || row.lokasi;
    return `Penyesuaian ${tabelLabel} oleh ${pelaku}`;
  }
  return '-';
}

function navigasiAktivitas(row, navigate) {
  if (row.jenis === 'pengambilan') navigate(`/admin/riwayat-pengambilan/${row.ref_id}`);
  else if (row.jenis === 'transfer') navigate(`/admin/riwayat-transfer/${row.ref_id}`);
  else if (row.jenis === 'barang_masuk') navigate(`/admin/riwayat-barang-masuk/${row.ref_id}`);
  else if (row.jenis === 'koreksi') navigate('/admin/koreksi');
}

// ─── sub-komponen ────────────────────────────────────────────────────────────

function SummaryCard({ label, nilai, warna, onClick, subLabel, subLabelWarna }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'white',
        border: '1px solid var(--warna-garis)',
        borderRadius: 14,
        padding: '16px 14px',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        flex: '1 1 0',
        minWidth: 0,
      }}
    >
      <div style={{
        fontFamily: 'var(--font-angka)',
        fontSize: 28,
        fontWeight: 800,
        color: warna || 'var(--warna-arang)',
        lineHeight: 1,
        marginBottom: 6,
      }}>
        {nilai}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warna-abu)' }}>
        {label}
      </div>
      {subLabel && (
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: subLabelWarna || 'var(--warna-bahaya)',
          marginTop: 5,
        }}>
          {subLabel}
        </div>
      )}
    </button>
  );
}

function AktivitasCard({ row, onClick }) {
  const cfg = JENIS_CFG[row.jenis] || {};
  const isKoreksi = row.label_status === 'Dikoreksi';
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'white',
        border: 'none',
        borderLeft: `3px solid ${cfg.warna || 'var(--warna-garis)'}`,
        padding: '12px 14px',
        cursor: 'pointer',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div style={{
        fontSize: 11,
        fontFamily: 'var(--font-angka)',
        color: 'var(--warna-abu)',
        minWidth: 36,
        paddingTop: 2,
        flexShrink: 0,
      }}>
        {formatJam(row.created_at)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warna-arang)', marginBottom: 2 }}>
          {cfg.prefix} {teksAktivitas(row)}
          {isKoreksi && (
            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--warna-bahaya)', background: '#FBEAE9', padding: '1px 5px', borderRadius: 4 }}>
              Dikoreksi
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--warna-abu)' }}>
          {row.lokasi}
          {row.lokasi_tujuan && ` → ${row.lokasi_tujuan}`}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--warna-abu)', flexShrink: 0, paddingTop: 2 }}>
        {waktuRelatif(row.created_at)}
      </div>
    </button>
  );
}

function FilterChip({ label, aktif, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 13px',
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
      {badge > 0 && (
        <span style={{
          background: aktif ? 'rgba(255,255,255,0.35)' : 'var(--warna-bahaya)',
          color: 'white',
          borderRadius: 10,
          fontSize: 10,
          fontWeight: 700,
          padding: '1px 5px',
          lineHeight: 1.4,
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

// Baris item dalam section Perlu Verifikasi
function VerifikasiRow({ icon, label, sublabel, onClick, isLast }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: 'none',
        border: 'none',
        borderBottom: isLast ? 'none' : '1px solid var(--warna-garis)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warna-arang)' }}>{label}</div>
        {sublabel && (
          <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginTop: 1 }}>{sublabel}</div>
        )}
      </div>
      <span style={{ fontSize: 14, color: 'var(--warna-karamel)', flexShrink: 0 }}>→</span>
    </button>
  );
}

// ─── halaman utama ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterJenis, setFilterJenis] = useState('semua');

  const muat = useCallback(async () => {
    try {
      const hasil = await api.get('/dashboard');
      setData(hasil);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    muat();
    const timer = setInterval(muat, 60000);
    function onFocus() { muat(); }
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [muat]);

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>
        Memuat dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <div className="pesan-error">{error}</div>
        <button
          onClick={muat}
          style={{ marginTop: 10, height: 40, padding: '0 16px', borderRadius: 8, border: '1.5px solid var(--warna-garis)', background: 'white', cursor: 'pointer', fontSize: 13 }}
        >
          Coba lagi
        </button>
      </div>
    );
  }

  const { summary, attention, activities, insights } = data || {};
  const attnStok      = attention?.stok_kritis      || [];
  const attnOpname    = attention?.opname_pending    || 0;
  const attnNota      = attention?.nota_menunggu     || 0;
  const attnTransfer  = attention?.transfer_pending  || 0;

  // Section "Perlu Verifikasi" — hanya tampil kalau ada sesuatu yang perlu diverifikasi
  const adaVerifikasi = attnTransfer > 0 || attnNota > 0 || attnOpname > 0;

  // Section "Perlu Perhatian" — hanya stok kritis
  const adaMasalahStok = attnStok.length > 0;

  const aktivitasFiltered = (activities || []).filter(
    (a) => filterJenis === 'semua' || a.jenis === filterJenis
  );

  const stokHabis  = attnStok.filter((r) => Number(r.stok_saat_ini) === 0);
  const stokMenipis = attnStok.filter((r) => Number(r.stok_saat_ini) > 0);

  // Baris verifikasi yang aktif (hanya yang > 0)
  const barisVerifikasi = [
    attnTransfer > 0 && {
      icon: '↗',
      label: `${attnTransfer} pemindahan menunggu konfirmasi penerimaan`,
      sublabel: 'Barang dikirim, belum dikonfirmasi diterima',
      onClick: () => navigate('/admin/riwayat-transfer'),
    },
    attnNota > 0 && {
      icon: '📋',
      label: `${attnNota} penerimaan barang menunggu verifikasi`,
      sublabel: 'Diinput crew, menunggu approval owner',
      onClick: () => navigate('/admin/verifikasi'),
    },
    attnOpname > 0 && {
      icon: '⏳',
      label: `${attnOpname} opname outlet menunggu approval`,
      sublabel: 'Disubmit crew, belum disetujui',
      onClick: () => navigate('/admin/opname/approval-outlet'),
    },
  ].filter(Boolean);

  return (
    <div style={{ paddingBottom: 80 }}>
      <ApprovalCenterCards role="owner" />

      {/* ── SECTION 1: TODAY SUMMARY ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
        }}>
          Hari Ini
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <SummaryCard
            label="Pengambilan"
            nilai={summary?.pengambilan ?? 0}
            onClick={() => navigate('/admin/riwayat-pengambilan')}
          />
          <SummaryCard
            label="Pemindahan"
            nilai={summary?.transfer ?? 0}
            onClick={() => navigate('/admin/riwayat-transfer')}
            subLabel={attnTransfer > 0 ? `${attnTransfer} perlu konfirmasi` : undefined}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <SummaryCard
            label="Penerimaan"
            nilai={summary?.barang_masuk ?? 0}
            onClick={() => navigate('/admin/riwayat-barang-masuk')}
            subLabel={attnNota > 0 ? `${attnNota} perlu verifikasi` : undefined}
          />
          <SummaryCard
            label="Penyesuaian"
            nilai={summary?.koreksi ?? 0}
            warna={summary?.koreksi > 0 ? 'var(--warna-bahaya)' : undefined}
            onClick={() => navigate('/admin/koreksi')}
          />
        </div>
      </div>

      {/* ── SECTION 2: PERLU VERIFIKASI (baru) ── */}
      {adaVerifikasi && (
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--warna-bahaya)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
          }}>
            Perlu Verifikasi
          </div>
          <div style={{
            background: 'white',
            border: '1.5px solid var(--warna-bahaya)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {barisVerifikasi.map((baris, i) => (
              <VerifikasiRow
                key={i}
                icon={baris.icon}
                label={baris.label}
                sublabel={baris.sublabel}
                onClick={baris.onClick}
                isLast={i === barisVerifikasi.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 3: PERLU PERHATIAN (stok kritis saja) ── */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
        }}>
          Perlu Perhatian
        </div>

        {!adaMasalahStok ? (
          <div style={{
            background: '#E9F3ED',
            border: '1px solid #b7d9c4',
            borderRadius: 12,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a5c36' }}>Stok semua normal</div>
              <div style={{ fontSize: 12, color: '#2d7a4f', marginTop: 1 }}>
                Tidak ada item kritis atau habis.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{
              padding: '10px 14px',
              background: stokHabis.length > 0 ? '#FBEAE9' : '#FDF6EC',
              borderBottom: '1px solid var(--warna-garis)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{stokHabis.length > 0 ? '🔴' : '⚠️'}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: stokHabis.length > 0 ? 'var(--warna-bahaya)' : '#7A5420' }}>
                  {attnStok.length} item {stokHabis.length > 0 ? `habis/menipis (${stokHabis.length} habis)` : 'menipis'}
                </span>
              </div>
              <button
                onClick={() => navigate('/admin/stok')}
                style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-karamel)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Lihat Stok →
              </button>
            </div>
            {[...stokHabis, ...stokMenipis].map((r) => {
              const habis = Number(r.stok_saat_ini) === 0;
              return (
                <div
                  key={`${r.gudang_id}-${r.item_id}`}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--warna-garis)',
                    background: habis ? '#FEF8F8' : 'white',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warna-arang)' }}>{r.nama_item}</div>
                    <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginTop: 1 }}>{r.nama_gudang}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: 'var(--font-angka)', fontSize: 14, fontWeight: 700,
                      color: habis ? 'var(--warna-bahaya)' : '#7A5420',
                    }}>
                      {Number(r.stok_saat_ini).toLocaleString('id-ID')} <span style={{ fontSize: 11, fontWeight: 400 }}>{r.satuan}</span>
                    </div>
                    {habis ? (
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-bahaya)', background: '#FBEAE9', padding: '1px 5px', borderRadius: 4, marginTop: 2 }}>
                        HABIS
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: '#9a6d30', marginTop: 1 }}>
                        min {r.reorder_point}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 4: ACTIVITY TODAY ── */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
        }}>
          Aktivitas Hari Ini
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', marginBottom: 10 }}>
          <FilterChip label="Semua" aktif={filterJenis === 'semua'} onClick={() => setFilterJenis('semua')} />
          {Object.entries(JENIS_CFG).map(([key, cfg]) => (
            <FilterChip
              key={key}
              label={cfg.label}
              aktif={filterJenis === key}
              onClick={() => setFilterJenis(key)}
              badge={key === 'transfer' ? attnTransfer : key === 'barang_masuk' ? attnNota : 0}
            />
          ))}
        </div>

        {aktivitasFiltered.length === 0 ? (
          <div style={{
            background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12,
            padding: '40px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>
              {filterJenis === 'semua'
                ? 'Belum ada aktivitas hari ini.'
                : `Belum ada aktivitas ${JENIS_CFG[filterJenis]?.label?.toLowerCase()} hari ini.`}
            </div>
          </div>
        ) : (
          <div style={{
            background: 'white',
            border: '1px solid var(--warna-garis)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {aktivitasFiltered.map((row, i) => (
              <div key={`${row.jenis}-${row.ref_id}`} style={{
                borderBottom: i < aktivitasFiltered.length - 1 ? '1px solid var(--warna-garis)' : 'none',
              }}>
                <AktivitasCard
                  row={row}
                  onClick={() => navigasiAktivitas(row, navigate)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 5: QUICK INSIGHTS ── */}
      {(insights?.item_terlaris || insights?.pct_perubahan !== null) && (
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
          }}>
            Insight
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {insights.item_terlaris && (
              <div style={{
                background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12,
                padding: '14px 16px',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Paling banyak diambil hari ini
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--warna-arang)' }}>
                  {insights.item_terlaris.nama}
                </div>
                <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 3 }}>
                  {Number(insights.item_terlaris.total_qty).toLocaleString('id-ID')} {insights.item_terlaris.satuan || 'unit'} dari {insights.item_terlaris.jumlah_outlet} outlet
                </div>
              </div>
            )}

            {insights.pct_perubahan !== null && insights.pct_perubahan !== undefined && insights.pengambilan_hari_ini > 0 && (
              <div style={{
                background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12,
                padding: '14px 16px',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Volume pengambilan
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--warna-arang)', fontFamily: 'var(--font-angka)' }}>
                    {insights.pengambilan_hari_ini} sesi
                  </div>
                  {insights.pct_perubahan !== 0 && (
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: insights.pct_perubahan > 0 ? 'var(--warna-sukses)' : 'var(--warna-bahaya)',
                    }}>
                      {insights.pct_perubahan > 0 ? '+' : ''}{insights.pct_perubahan}%
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 3 }}>
                  {insights.pct_perubahan > 0
                    ? `Meningkat dibanding rata-rata 7 hari lalu`
                    : insights.pct_perubahan < 0
                      ? `Menurun dibanding rata-rata 7 hari lalu`
                      : `Sama dengan rata-rata 7 hari lalu`}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
}
