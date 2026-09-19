import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

function waktuRelatif(iso) {
  const detik = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  if (detik < 172800) return 'kemarin';
  return `${Math.floor(detik / 86400)} hari lalu`;
}

function ikonTipe(tipe) {
  if (tipe === 'CATATAN_BARU') return '💬';
  if (tipe === 'PENGAMBILAN_DIKOREKSI') return '⚠️';
  if (tipe === 'OPNAME_DISETUJUI') return '✓';
  if (tipe === 'OPNAME_DITOLAK') return '✕';
  return '🔔';
}

export default function NotifikasiCrew() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function muat() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/notifikasi');
      setNotifs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat notifikasi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { muat(); }, []);

  async function tandaiDibaca(id) {
    try {
      await api.patch(`/notifikasi/${id}/read`);
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch {
      // diam-diam gagal
    }
  }

  async function tandaiSemuaDibaca() {
    try {
      await api.patch('/notifikasi/read-all');
      const now = new Date().toISOString();
      setNotifs((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    } catch {
      // diam-diam gagal
    }
  }

  function klikNotif(notif) {
    if (!notif.read_at) tandaiDibaca(notif.id);
    if (notif.reference_tipe === 'sesi_pengambilan' && notif.reference_id) {
      navigate(`/crew/riwayat/${notif.reference_id}`);
    }
  }

  const belumDibaca = notifs.filter((n) => !n.read_at).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ background: 'var(--warna-arang)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 36, height: 36, color: 'white', fontSize: 20, cursor: 'pointer' }}
        >
          ‹
        </button>
        <div style={{ color: 'white', fontSize: 15, fontWeight: 700, flex: 1 }}>
          Notifikasi {belumDibaca > 0 && <span style={{ background: 'var(--warna-bahaya)', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{belumDibaca}</span>}
        </div>
        {belumDibaca > 0 && (
          <button
            onClick={tandaiSemuaDibaca}
            style={{ background: 'none', border: 'none', color: '#c0b4a8', fontSize: 12, cursor: 'pointer' }}
          >
            Baca semua
          </button>
        )}
      </div>

      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>Memuat...</div>
        ) : error ? (
          <div style={{ padding: '16px' }}>
            <div className="pesan-error">{error}</div>
            <button onClick={muat} style={{ marginTop: 8, width: '100%', height: 44, borderRadius: 10, border: '1.5px solid var(--warna-garis)', background: 'white', color: 'var(--warna-arang)', fontSize: 14, cursor: 'pointer' }}>Coba lagi</button>
          </div>
        ) : notifs.length === 0 ? (
          <div style={{ padding: '60px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔔</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--warna-arang)', marginBottom: 4 }}>Belum ada notifikasi</div>
            <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Notifikasi akan muncul di sini.</div>
          </div>
        ) : (
          notifs.map((notif) => (
            <button
              key={notif.id}
              onClick={() => klikNotif(notif)}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', gap: 12,
                padding: '14px 16px',
                background: notif.read_at ? 'white' : 'rgba(166,120,80,0.06)',
                borderBottom: '1px solid var(--warna-garis)',
                border: 'none', cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{ikonTipe(notif.tipe)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: notif.read_at ? 500 : 700, color: 'var(--warna-arang)', marginBottom: 2 }}>
                  {notif.judul}
                </div>
                {notif.pesan && (
                  <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginBottom: 4, lineHeight: 1.4 }}>
                    {notif.pesan}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--warna-garis)' }}>{waktuRelatif(notif.created_at)}</div>
              </div>
              {!notif.read_at && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warna-karamel)', flexShrink: 0, marginTop: 6 }} />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
