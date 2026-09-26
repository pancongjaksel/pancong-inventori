import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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

export default function PengambilanDetailAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const kembali = () => navigate(location.state?.returnTo || -1);
  const [sesi, setSesi] = useState(null);
  const [aktivitas, setAktivitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [catatan, setCatatan] = useState('');
  const [kirimLoading, setKirimLoading] = useState(false);
  const [kirimError, setKirimError] = useState(null);

  async function muat() {
    setLoading(true);
    setError(null);
    try {
      const [sesiData, aktivitasData] = await Promise.all([
        api.get(`/sesi-pengambilan-crew/${id}`),
        api.get(`/sesi-pengambilan-crew/${id}/aktivitas`),
      ]);
      setSesi(sesiData);
      setAktivitas(Array.isArray(aktivitasData) ? aktivitasData : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat detail.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { muat(); }, [id]);

  async function kirimCatatan(e) {
    e.preventDefault();
    const teks = catatan.trim();
    if (!teks) return;
    setKirimLoading(true);
    setKirimError(null);
    try {
      await api.post(`/sesi-pengambilan-crew/${id}/catatan`, { catatan: teks });
      setCatatan('');
      // reload aktivitas only
      const aktivitasData = await api.get(`/sesi-pengambilan-crew/${id}/aktivitas`);
      setAktivitas(Array.isArray(aktivitasData) ? aktivitasData : []);
    } catch (err) {
      setKirimError(err instanceof ApiError ? err.message : 'Gagal mengirim catatan.');
    } finally {
      setKirimLoading(false);
    }
  }

  if (loading) return (
    <div className="admin-page">
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>Memuat...</div>
    </div>
  );

  if (error) return (
    <div className="admin-page">
      <div style={{ padding: 20 }}>
        <button
          onClick={kembali}
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
    <div className="admin-page">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--warna-garis)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={kembali}
          style={{ background: 'none', border: 'none', color: 'var(--warna-karamel)', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--warna-arang)' }}>
            Pengambilan #{sesi.id}
            {isKoreksi && (
              <span style={{ marginLeft: 8, background: '#FBEAE9', color: 'var(--warna-bahaya)', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>
                Dikoreksi
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 2 }}>{waktuFormatted(sesi.created_at)}</div>
        </div>
      </div>

      <div style={{ padding: '16px 20px', maxWidth: 720 }}>
        {/* Info card */}
        <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, padding: '16px', marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Outlet</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warna-arang)' }}>{sesi.nama_outlet_tujuan}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Gudang Asal</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warna-arang)' }}>{sesi.nama_gudang_asal}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Crew</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warna-arang)' }}>{sesi.nama_crew}</div>
          </div>
        </div>

        {/* Items */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Barang ({sesi.items?.length ?? 0})
        </div>
        <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          {(sesi.items ?? []).map((item, i) => (
            <div
              key={item.item_id}
              style={{
                padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: i < (sesi.items.length - 1) ? '1px solid var(--warna-garis)' : 'none',
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
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Aktivitas & Catatan
        </div>

        {aktivitas.length > 0 && (
          <div style={{ position: 'relative', paddingLeft: 20, marginBottom: 20 }}>
            <div style={{ position: 'absolute', left: 4, top: 6, bottom: 6, width: 2, background: 'var(--warna-garis)' }} />
            {aktivitas.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: 12, marginBottom: 16, position: 'relative' }}>
                <AktivitasDot tipe={a.tipe} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warna-arang)' }}>{a.judul}</div>
                  {a.deskripsi && (
                    <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 2, lineHeight: 1.4 }}>{a.deskripsi}</div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--warna-garis)', marginTop: 4 }}>
                    {new Date(a.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {a.actor_nama && ` · ${a.actor_nama}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tambah catatan */}
        <form onSubmit={kirimCatatan} style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warna-arang)', marginBottom: 10 }}>Tambah Catatan untuk Crew</div>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Tulis catatan atau keterangan..."
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              borderRadius: 8, border: '1.5px solid var(--warna-garis)',
              padding: '10px 12px', fontSize: 13, color: 'var(--warna-arang)',
              resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
              outline: 'none',
            }}
          />
          {kirimError && <div className="pesan-error" style={{ marginTop: 8 }}>{kirimError}</div>}
          <button
            type="submit"
            disabled={kirimLoading || !catatan.trim()}
            style={{
              marginTop: 10, height: 40, padding: '0 20px',
              borderRadius: 8, border: 'none',
              background: catatan.trim() ? 'var(--warna-arang)' : 'var(--warna-garis)',
              color: 'white', fontSize: 13, fontWeight: 600, cursor: catatan.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {kirimLoading ? 'Mengirim...' : 'Kirim Catatan'}
          </button>
        </form>
      </div>
    </div>
  );
}
