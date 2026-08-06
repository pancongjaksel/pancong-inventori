import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { api, authStorage, ApiError } from '../api/client';
import TopBar from '../components/TopBar';

const ID_SCANNER = 'pj-qr-scanner';

/** Ambil isi param `token` dari URL hasil scan, atau anggap hasil scan itu sendiri token-nya. */
function ekstrakToken(hasilScan) {
  try {
    const url = new URL(hasilScan);
    const token = url.searchParams.get('token');
    if (token) return token;
  } catch {
    // bukan URL valid, lanjut anggap hasilScan = token mentah
  }
  return hasilScan.trim();
}

export default function SetupDevice() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('pilih'); // 'pilih' | 'generate' | 'scan'
  const [gudangList, setGudangList] = useState([]);
  const [qrHasil, setQrHasil] = useState(null); // { namaGudang, qrContent, token }
  const [tokenHasilScan, setTokenHasilScan] = useState(null);
  const [namaDevice, setNamaDevice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);

  // Cara PALING umum dipakai beneran: crew buka aplikasi kamera BAWAAN HP
  // (bukan kamera di dalam web ini), arahkan ke QR fisik, HP otomatis buka
  // link-nya di browser (`...?token=xxx`) — gak butuh izin kamera browser
  // sama sekali, jadi gak kena batasan HTTPS. Kalau link ini yang kebuka
  // (ada param `token` di URL), langsung skip ke form nama device, gak
  // perlu buka kamera di dalam web lagi.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenDariUrl = params.get('token');
    if (tokenDariUrl) {
      setTokenHasilScan(tokenDariUrl);
      setMode('scan');
    }
  }, []);

  useEffect(() => {
    if (!authStorage.ambilAdminToken()) {
      navigate('/login');
      return;
    }
    api.get('/master/gudangs').then(setGudangList).catch(() => {});
  }, [navigate]);

  useEffect(() => {
    if (mode !== 'scan' || tokenHasilScan) return; // udah dapet token dari URL, gak perlu buka kamera lagi

    const scanner = new Html5Qrcode(ID_SCANNER);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 240 },
        (hasilScan) => {
          setTokenHasilScan(ekstrakToken(hasilScan));
          scanner.stop().catch(() => {});
        },
        () => {} // diabaikan — dipanggil terus-menerus tiap frame gak nemu QR, bukan error beneran
      )
      .catch(() => setError('Gagal mengakses kamera. Pastikan izin kamera diaktifkan di browser.'));

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [mode]);

  async function generateQr(gudangId) {
    setError(null);
    setLoading(true);
    try {
      const hasil = await api.get(`/device-gudang/qr/${gudangId}`);
      setQrHasil(hasil);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat QR.');
    } finally {
      setLoading(false);
    }
  }

  async function submitSetup(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const hasil = await api.post('/device-gudang/setup', { token: tokenHasilScan, namaDevice });
      authStorage.simpanDevice(hasil.deviceToken, {
        deviceId: hasil.deviceId,
        gudangId: hasil.gudangId,
        namaGudang: hasil.namaGudang,
      });
      // Device ini sekarang jadi device Crew bersama, bukan lagi sesi Admin —
      // hapus token admin biar request berikutnya di device ini otomatis
      // pakai auth device (lihat api/client.js: admin token diprioritaskan
      // kalau ada, jadi kalau gak dihapus endpoint requireDevice bakal ditolak).
      authStorage.hapusAdminToken();
      navigate('/crew');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal setup device.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="layar">
      <TopBar
        judul="Setup Device"
        konteks="Login Admin"
        aksi={
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => navigate('/admin')}
              style={{ background: 'none', border: 'none', color: 'var(--warna-krim-redup)', fontSize: 13, cursor: 'pointer' }}
            >
              Dashboard
            </button>
            <button
              onClick={() => {
                authStorage.hapusAdminToken();
                navigate('/login');
              }}
              style={{ background: 'none', border: 'none', color: 'var(--warna-krim-redup)', fontSize: 13, cursor: 'pointer' }}
            >
              Keluar
            </button>
          </div>
        }
      />
      <div className="konten">
        {error && <div className="pesan-error">{error}</div>}

        {mode === 'pilih' && (
          <>
            <p style={{ color: 'var(--warna-abu)', marginTop: 0 }}>
              Pilih salah satu: buat QR baru buat ditempel di gudang, atau scan QR yang udah ditempel buat masangin HP ini.
            </p>
            <button className="tombol tombol--primer" style={{ marginBottom: 12 }} onClick={() => setMode('generate')}>
              Buat QR gudang (buat dicetak)
            </button>
            <button className="tombol tombol--sekunder" onClick={() => setMode('scan')}>
              Scan QR (setup HP ini)
            </button>
          </>
        )}

        {mode === 'generate' && !qrHasil && (
          <>
            <p className="label" style={{ marginBottom: 12 }}>Pilih gudang</p>
            {gudangList
              .filter((g) => g.tipe === 'serving')
              .map((g) => (
                <button
                  key={g.id}
                  className="tombol tombol--sekunder"
                  style={{ marginBottom: 10 }}
                  onClick={() => generateQr(g.id)}
                  disabled={loading}
                >
                  {g.nama}
                </button>
              ))}
          </>
        )}

        {mode === 'generate' && qrHasil && (
          <div className="kartu" style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 700, marginTop: 0 }}>QR Gudang {qrHasil.namaGudang}</p>
            <img
              alt={`QR setup Gudang ${qrHasil.namaGudang}`}
              style={{ width: '100%', maxWidth: 280 }}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrHasil.qrContent)}`}
            />
            <p style={{ fontSize: 13, color: 'var(--warna-abu)' }}>
              Print/screenshot gambar ini, tempel fisik di Gudang {qrHasil.namaGudang}. QR ini gak expired, bisa dipakai berkali-kali buat pasang banyak HP.
            </p>
            <button
              type="button"
              className="tombol tombol--sekunder"
              style={{ marginTop: 12 }}
              onClick={() => {
                // Buka link setup di ORIGIN LOKAL (bukan qrHasil.qrContent yang
                // nunjuk ke domain production) — buat testing tanpa kamera/tanpa
                // perlu scan fisik sama sekali.
                window.location.href = `${window.location.origin}/setup-device?token=${qrHasil.token}`;
              }}
            >
              Buka langsung (tes tanpa kamera)
            </button>
          </div>
        )}

        {mode === 'scan' && !tokenHasilScan && (
          <div>
            <div id={ID_SCANNER} style={{ width: '100%', borderRadius: 14, overflow: 'hidden' }} />
            <p style={{ fontSize: 13, color: 'var(--warna-abu)', textAlign: 'center' }}>
              Arahkan kamera ke QR yang ditempel di gudang.
            </p>
          </div>
        )}

        {mode === 'scan' && tokenHasilScan && (
          <form onSubmit={submitSetup}>
            <div className="pesan-sukses">QR terbaca. Kasih nama buat HP ini, lalu simpan.</div>
            <div className="field">
              <label className="label" htmlFor="namaDevice">Nama device</label>
              <input
                id="namaDevice"
                className="input-teks"
                placeholder='mis. "HP Kasir UGM 1"'
                value={namaDevice}
                onChange={(e) => setNamaDevice(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="tombol tombol--primer" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Simpan & selesai'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
