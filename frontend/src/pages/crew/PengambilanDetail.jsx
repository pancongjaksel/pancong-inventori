import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

function waktuFormatted(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function AktivitasDot({ tipe }) {
  const warna = {
    PENGAMBILAN_DIBUAT: 'var(--warna-sukses)',
    PENGAMBILAN_DIKOREKSI: 'var(--warna-bahaya)',
    ITEM_DIKOREKSI_CEPAT: 'var(--warna-bahaya)',
    CATATAN_DITAMBAHKAN: 'var(--warna-karamel)',
  }[tipe] ?? 'var(--warna-abu)';
  return (
    <div style={{
      width: 10, height: 10, borderRadius: '50%',
      background: warna, flexShrink: 0, marginTop: 4,
    }} />
  );
}

export default function PengambilanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sesi, setSesi] = useState(null);
  const [aktivitas, setAktivitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/sesi-pengambilan-crew/${id}`),
      api.get(`/sesi-pengambilan-crew/${id}/aktivitas`),
    ])
      .then(([sesiData, aktivitasData]) => {
        setSesi(sesiData);
        setAktivitas(Array.isArray(aktivitasData) ? aktivitasData : []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat detail.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>
      Memuat...
    </div>
  );

  if (error) return (
    <div className="mobile-page">
      <div className="mobile-page__content">
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--warna-karamel)', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 16 }}
        >
          ← Kembali
        </button>
        <div className="pesan-error">{error}</div>
      </div>
    </div>
  );

  if (!sesi) return null;

  const isKoreksi = sesi.label_status === 'Dikoreksi';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Dark header */}
      <div style={{ background: 'var(--warna-arang)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 36, height: 36, color: 'white', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}
        >
          ‹
        </button>
        <div>
          <div style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>
            Pengambilan #{sesi.id}
          </div>
          <div style={{ color: '#c0b4a8', fontSize: 11, marginTop: 1 }}>
            {waktuFormatted(sesi.created_at)}
          </div>
        </div>
        {isKoreksi && (
          <div style={{ marginLeft: 'auto', background: '#FBEAE9', color: 'var(--warna-bahaya)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>
            Dikoreksi
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: '16px', paddingBottom: 100 }}>
        {/* Info */}
        <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, padding: '14px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Outlet</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warna-arang)' }}>{sesi.nama_outlet_tujuan}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Gudang</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warna-arang)' }}>{sesi.nama_gudang_asal}</div>
            </div>
          </div>
        </div>

        {/* Barang */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Barang ({sesi.items?.length ?? 0})
        </div>
        <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          {sesi.items?.map((item, i) => (
            <div
              key={item.item_id}
              style={{
                padding: '12px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: i < sesi.items.length - 1 ? '1px solid var(--warna-garis)' : 'none',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--warna-arang)' }}>{item.nama}</div>
                <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginTop: 1 }}>{item.satuan}</div>
                {item.qty_asli !== null && (
                  <div style={{ fontSize: 11, color: 'var(--warna-bahaya)', marginTop: 2 }}>
                    Dikoreksi dari {Number(item.qty_asli).toLocaleString('id-ID')}
                  </div>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-angka)', fontSize: 16, fontWeight: 700, color: 'var(--warna-arang)' }}>
                {Number(item.qty).toLocaleString('id-ID')}
              </div>
            </div>
          ))}
        </div>

        {/* Aktivitas timeline */}
        {aktivitas.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Aktivitas
            </div>
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              {/* Vertical line */}
              <div style={{
                position: 'absolute', left: 4, top: 6, bottom: 6,
                width: 2, background: 'var(--warna-garis)',
              }} />
              {aktivitas.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 12, marginBottom: 16, position: 'relative' }}>
                  <AktivitasDot tipe={a.tipe} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warna-arang)' }}>{a.judul}</div>
                    {a.deskripsi && (
                      <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 2, lineHeight: 1.4 }}>{a.deskripsi}</div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--warna-garis)', marginTop: 4 }}>
                      {new Date(a.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      {a.actor_nama && ` · ${a.actor_nama}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
