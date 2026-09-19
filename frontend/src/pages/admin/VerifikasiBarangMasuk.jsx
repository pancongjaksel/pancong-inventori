import { useEffect, useState } from 'react';
import { api, urlLengkapUpload, ApiError } from '../../api/client';

export default function VerifikasiBarangMasuk() {
  const [daftar, setDaftar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aksiTerbuka, setAksiTerbuka] = useState(null); // { notaId, tipe: 'revisi'|'tolak' }
  const [revisiPerItem, setRevisiPerItem] = useState({}); // { [itemRowId]: jumlahBaru }
  const [catatan, setCatatan] = useState('');
  const [prosesId, setProsesId] = useState(null);

  function muatUlang() {
    setLoading(true);
    api
      .get('/barang-masuk-nota?status=menunggu')
      .then(setDaftar)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }

  useEffect(muatUlang, []);

  function bukaAksi(nota, tipe) {
    setAksiTerbuka({ notaId: nota.id, tipe });
    // Prefill revisi pakai jumlah asli tiap item, biar admin tinggal ubah yang perlu
    const prefill = {};
    nota.items.forEach((it) => { prefill[it.item_row_id] = it.jumlah; });
    setRevisiPerItem(prefill);
    setCatatan('');
    setError(null);
  }

  async function kirimAksi(notaId, aksi, body) {
    setError(null);
    setProsesId(notaId);
    try {
      await api.patch(`/barang-masuk-nota/${notaId}/verifikasi`, { aksi, ...body });
      setAksiTerbuka(null);
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memproses.');
    } finally {
      setProsesId(null);
    }
  }

  function submitRevisi(nota) {
    const revisiItems = nota.items.map((it) => ({
      itemRowId: it.item_row_id,
      jumlahBaru: Number(revisiPerItem[it.item_row_id]),
    }));
    kirimAksi(nota.id, 'revisi', { revisiItems, catatan });
  }

  if (loading) return <p style={{ color: 'var(--warna-abu)' }}>Memuat...</p>;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}

      {daftar.length > 0 && (
        <div className="verifikasi-banner">
          {daftar.length} nota barang masuk menunggu verifikasi
        </div>
      )}

      {daftar.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--warna-abu)', marginTop: 40 }}>
          Gak ada nota barang masuk yang perlu diverifikasi saat ini.
        </p>
      )}

      {daftar.map((nota) => (
        <div key={nota.id} className="kartu" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700 }}>
                Nota #{nota.id} — {nota.nama_gudang}
                <span className={`verifikasi-badge-role verifikasi-badge-role--${nota.diinput_oleh_role === 'crew' ? 'crew' : 'admin'}`}>
                  {nota.diinput_oleh_role === 'crew' ? 'Crew' : 'Admin'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>
                Diinput oleh {nota.diinput_oleh_role === 'crew' ? nota.nama_crew_input : nota.diinput_oleh_admin_nama}
              </div>
              {nota.sumber && <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Sumber: {nota.sumber}</div>}
            </div>
          </div>

          <a href={urlLengkapUpload(nota.foto_bukti_url)} target="_blank" rel="noreferrer" className="verifikasi-foto-link">
            Foto bukti →
          </a>

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--warna-garis)' }}>
            <p className="label" style={{ marginBottom: 6 }}>Item ({nota.items.length})</p>
            {nota.items.map((it) => (
              <div key={it.item_row_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
                <span>{it.nama_item}</span>
                {aksiTerbuka?.notaId === nota.id && aksiTerbuka.tipe === 'revisi' ? (
                  <input
                    type="number"
                    className="input-teks"
                    style={{ width: 90, height: 32, padding: '4px 8px' }}
                    value={revisiPerItem[it.item_row_id] ?? ''}
                    onChange={(e) => setRevisiPerItem((prev) => ({ ...prev, [it.item_row_id]: e.target.value }))}
                  />
                ) : (
                  <span style={{ fontFamily: 'var(--font-angka)', fontWeight: 600 }}>{it.jumlah} {it.satuan}</span>
                )}
              </div>
            ))}
          </div>

          {aksiTerbuka?.notaId === nota.id ? (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--warna-garis)' }}>
              <div className="field">
                <label className="label">{aksiTerbuka.tipe === 'tolak' ? 'Alasan tolak (wajib)' : 'Catatan (opsional)'}</label>
                <input className="input-teks" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="tombol tombol--sekunder" onClick={() => setAksiTerbuka(null)}>Batal</button>
                <button
                  className={`tombol ${aksiTerbuka.tipe === 'tolak' ? 'tombol--bahaya' : 'tombol--primer'}`}
                  disabled={prosesId === nota.id || (aksiTerbuka.tipe === 'tolak' && !catatan.trim())}
                  onClick={() =>
                    aksiTerbuka.tipe === 'revisi' ? submitRevisi(nota) : kirimAksi(nota.id, 'tolak', { catatan })
                  }
                >
                  {prosesId === nota.id ? <span className="spinner" /> : aksiTerbuka.tipe === 'tolak' ? 'Tolak nota' : 'Simpan revisi & setujui'}
                </button>
              </div>
            </div>
          ) : (
            <div className="verifikasi-aksi">
              <button
                className="tombol tombol--primer"
                style={{ height: 44 }}
                disabled={prosesId === nota.id}
                onClick={() => kirimAksi(nota.id, 'setujui', {})}
              >
                {prosesId === nota.id ? <span className="spinner" /> : 'Setujui semua'}
              </button>
              <button className="tombol tombol--sekunder" style={{ height: 44 }} onClick={() => bukaAksi(nota, 'revisi')}>
                Revisi
              </button>
              <button className="tombol tombol--bahaya" style={{ height: 44 }} onClick={() => bukaAksi(nota, 'tolak')}>
                Tolak
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
