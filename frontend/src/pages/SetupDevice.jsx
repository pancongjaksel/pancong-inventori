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

/** Ambil param `type` dari URL hasil scan (kalau ada) — 'admin-gudang' atau default gudang biasa. */
function ekstrakTipe(hasilScan) {
  try {
    const url = new URL(hasilScan);
    return url.searchParams.get('type') === 'admin-gudang' ? 'admin-gudang' : 'gudang';
  } catch {
    return 'gudang';
  }
}

export default function SetupDevice() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('pilih'); // 'pilih' | 'generate' | 'scan'
  const [tipeGenerate, setTipeGenerate] = useState('gudang'); // 'gudang' | 'admin-gudang' — cuma relevan pas mode='generate'
  const [tipeSetup, setTipeSetup] = useState('gudang'); // 'gudang' | 'admin-gudang' — dari hasil scan/deep-link
  const [gudangList, setGudangList] = useState([]);
  const [qrHasil, setQrHasil] = useState(null); // { namaGudang?, qrContent, token }
  const [tokenHasilScan, setTokenHasilScan] = useState(null);
  const [nama, setNama] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);

  const isAdminSession = Boolean(authStorage.ambilAdminToken());

  // Cara PALING umum dipakai beneran: crew/admin-gudang buka aplikasi kamera
  // BAWAAN HP (bukan kamera di dalam web ini), arahkan ke QR fisik, HP
  // otomatis buka link-nya di browser (`...?token=xxx`) — gak butuh izin
  // kamera browser sama sekali, jadi gak kena batasan HTTPS. HP itu JELAS
  // gak punya sesi admin (bukan HP yang dipakai buat login admin), jadi kalau
  // ada `token` di URL, ini pasti alur mulai sesi dari scan, dan HARUS
  // bisa diakses tanpa admin login sama sekali — makanya dicek & di-`return`
  // duluan SEBELUM cek admin token di bawah, dalam efek yang SAMA (biar gak
  // ada race condition antara dua efek terpisah yang jalan di render yang sama
  // sebelum state sempat ke-update).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenDariUrl = params.get('token');

    if (tokenDariUrl) {
      // Scan BARU selalu menang, walau browser ini udah punya sesi tersimpan
      // (mis. mau ganti nama, atau QR di-scan ulang buat mulai sesi baru —
      // kalau reuse-check dicek DULUAN tanpa syarat, alur ini gak akan
      // pernah kepakai, browser bakal ke-redirect balik ke /crew atau
      // /admin-gudang duluan sebelum sempat baca token scan yang baru).
      setTokenHasilScan(tokenDariUrl);
      setTipeSetup(params.get('type') === 'admin-gudang' ? 'admin-gudang' : 'gudang');
      setMode('scan');
      return; // ini mulai sesi dari scan — skip total pengecekan admin di bawah
    }

    // SESI REUSE: gak ada scan baru, tapi browser ini udah punya sesi
    // tersimpan — langsung ke shell-nya, gak perlu tampilin pilihan
    // generate/scan lagi.
    const deviceTokenExisting = authStorage.ambilDeviceToken();
    if (deviceTokenExisting) {
      const role = authStorage.ambilDeviceRole();
      navigate(role === 'admin_gudang' ? '/admin-gudang' : '/crew');
      return;
    }

    if (!authStorage.ambilAdminToken()) {
      navigate('/login');
      return;
    }
    api.get('/master/gudangs').then(setGudangList).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          setTipeSetup(ekstrakTipe(hasilScan));
          scanner.stop().catch(() => {});
        },
        () => {} // diabaikan — dipanggil terus-menerus tiap frame gak nemu QR, bukan error beneran
      )
      .catch(() => setError('Gagal mengakses kamera. Pastikan izin kamera diaktifkan di browser.'));

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [mode, tokenHasilScan]);

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

  async function generateQrAdminGudang() {
    setError(null);
    setLoading(true);
    try {
      const hasil = await api.get('/device-admin-gudang/qr');
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
      if (tipeSetup === 'admin-gudang') {
        const hasil = await api.post('/device-admin-gudang/setup', { token: tokenHasilScan, nama });
        authStorage.simpanDevice(hasil.deviceToken, {
          nama: hasil.nama,
        });
        // Setelah sesi kemulai, browser ini jadi "sesi ini" — hapus sesi
        // admin (kalau ada) biar HalamanAwal gak bingung dua identitas
        // sekaligus. Request setup di atas udah kelar duluan, jadi aman
        // hapus token admin-nya SEKARANG (bukan sebelum request).
        authStorage.hapusAdminToken();
        navigate('/admin-gudang');
      } else {
        const hasil = await api.post('/device-gudang/setup', { token: tokenHasilScan, nama });
        authStorage.simpanDevice(hasil.deviceToken, {
          gudangId: hasil.gudangId,
          namaGudang: hasil.namaGudang,
          nama: hasil.nama,
        });
        authStorage.hapusAdminToken();
        navigate('/crew');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mulai sesi.');
    } finally {
      setLoading(false);
    }
  }

  const konteksLabel = !isAdminSession
    ? (tipeSetup === 'admin-gudang' ? 'Mulai Sesi Admin Gudang' : 'Mulai Sesi Crew')
    : 'Admin — Kelola QR Device';

  return (
    <div className="layar">
      <TopBar
        judul="Setup Device"
        konteks={konteksLabel}
        aksi={
          isAdminSession ? (
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
          ) : null
        }
      />
      <div className="konten">
        {error && <div className="pesan-error">{error}</div>}

        {mode === 'pilih' && (
          <>
            <p style={{ color: 'var(--warna-abu)', marginTop: 0 }}>
              Pilih salah satu: buat QR baru buat ditempel/disimpan, atau scan QR yang udah ada buat mulai sesi di HP ini.
            </p>
            <button
              className="tombol tombol--primer"
              style={{ marginBottom: 12 }}
              onClick={() => {
                setTipeGenerate('gudang');
                setMode('generate');
              }}
            >
              Buat QR gudang (buat dicetak)
            </button>
            <button
              className="tombol tombol--sekunder"
              style={{ marginBottom: 12 }}
              onClick={() => {
                setTipeGenerate('admin-gudang');
                setMode('generate');
                generateQrAdminGudang();
              }}
            >
              Buat QR Admin Gudang
            </button>
            <button className="tombol tombol--sekunder" onClick={() => setMode('scan')}>
              Scan QR (mulai sesi di HP ini)
            </button>
          </>
        )}

        {mode === 'generate' && tipeGenerate === 'gudang' && !qrHasil && (
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
            <p style={{ fontWeight: 700, marginTop: 0 }}>
              {tipeGenerate === 'admin-gudang' ? 'QR Admin Gudang' : `QR Gudang ${qrHasil.namaGudang}`}
            </p>
            <img
              alt={tipeGenerate === 'admin-gudang' ? 'QR setup Admin Gudang' : `QR setup Gudang ${qrHasil.namaGudang}`}
              style={{ width: '100%', maxWidth: 280 }}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrHasil.qrContent)}`}
            />
            <p style={{ fontSize: 13, color: 'var(--warna-abu)' }}>
              {tipeGenerate === 'admin-gudang'
                ? 'QR ini gak terikat ke gudang manapun — siapapun yang scan & isi nama langsung dapat akses Admin Gudang. QR gak expired, bisa dipakai berkali-kali.'
                : `Print/screenshot gambar ini, tempel fisik di Gudang ${qrHasil.namaGudang}. QR ini gak expired, bisa dipakai berkali-kali buat mulai sesi di banyak HP.`}
            </p>
            <button
              type="button"
              className="tombol tombol--sekunder"
              style={{ marginTop: 12 }}
              onClick={() => {
                const typeParam = tipeGenerate === 'admin-gudang' ? '&type=admin-gudang' : '';
                window.location.href = `${window.location.origin}/setup-device?token=${qrHasil.token}${typeParam}`;
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
            <div className="pesan-sukses">
              QR terbaca ({tipeSetup === 'admin-gudang' ? 'Admin Gudang' : 'Gudang'}). Kasih nama kamu, lalu simpan.
            </div>
            <div className="field">
              <label className="label" htmlFor="nama">Nama kamu</label>
              <input
                id="nama"
                className="input-teks"
                placeholder="Ketik nama kamu"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
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
