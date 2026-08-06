import { useEffect, useState } from 'react';
import { api, urlLengkapUpload, ApiError } from '../../api/client';

export default function VerifikasiBarangMasuk() {
  const [daftar, setDaftar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aksiTerbuka, setAksiTerbuka] = useState(null); // { id, tipe: 'revisi'|'tolak' }
  const [jumlahRevisi, setJumlahRevisi] = useState('');
  const [catatan, setCatatan] = useState('');
  const [prosesId, setProsesId] = useState(null);

  function muatUlang() {
    setLoading(true);
    api
      .get('/barang-masuk?status=menunggu')
      .then(setDaftar)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }

  useEffect(muatUlang, []);

  function bukaAksi(id, tipe) {
    setAksiTerbuka({ id, tipe });
    setJumlahRevisi('');
    setCatatan('');
    setError(null);
  }

  async function kirimAksi(id, aksi, body) {
    setError(null);
    setProsesId(id);
    try {
      await api.patch(`/barang-masuk/${id}/verifikasi`, { aksi, ...body });
      setAksiTerbuka(null);
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memproses.');
    } finally {
      setProsesId(null);
    }
  }

  if (loading) return <p style={{ color: 'var(--warna-abu)' }}>Memuat...</p>;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}

      {daftar.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--warna-abu)', marginTop: 40 }}>
          Gak ada barang masuk yang perlu diverifikasi saat ini.
        </p>
      )}

      {daftar.map((tx) => (
        <div key={tx.id} className="kartu" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{tx.nama_item}</div>
              <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>
                {tx.nama_gudang} · diinput oleh {tx.diinput_oleh_role === 'crew' ? `${tx.nama_crew_input} (Crew)` : tx.diinput_oleh_admin_nama}
              </div>
              {tx.sumber && <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Sumber: {tx.sumber}</div>}
            </div>
            <div style={{ fontFamily: 'var(--font-angka)', fontWeight: 700, textAlign: 'right' }}>
              {tx.jumlah} {tx.satuan}
            </div>
          </div>

          <a href={urlLengkapUpload(tx.foto_bukti_url)} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--warna-karamel)' }}>
            Lihat foto bukti →
          </a>

          {aksiTerbuka?.id === tx.id ? (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--warna-garis)' }}>
              {aksiTerbuka.tipe === 'revisi' && (
                <div className="field">
                  <label className="label">Jumlah yang benar</label>
                  <input
                    type="number"
                    className="input-teks"
                    value={jumlahRevisi}
                    onChange={(e) => setJumlahRevisi(e.target.value)}
                    placeholder={`Sebelumnya: ${tx.jumlah}`}
                  />
                </div>
              )}
              <div className="field">
                <label className="label">{aksiTerbuka.tipe === 'tolak' ? 'Alasan tolak (wajib)' : 'Catatan (opsional)'}</label>
                <input className="input-teks" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="tombol tombol--sekunder" onClick={() => setAksiTerbuka(null)}>Batal</button>
                <button
                  className={`tombol ${aksiTerbuka.tipe === 'tolak' ? 'tombol--bahaya' : 'tombol--primer'}`}
                  disabled={prosesId === tx.id || (aksiTerbuka.tipe === 'tolak' && !catatan.trim()) || (aksiTerbuka.tipe === 'revisi' && !jumlahRevisi)}
                  onClick={() =>
                    kirimAksi(tx.id, aksiTerbuka.tipe, aksiTerbuka.tipe === 'revisi' ? { jumlahRevisi: Number(jumlahRevisi), catatan } : { catatan })
                  }
                >
                  {prosesId === tx.id ? <span className="spinner" /> : aksiTerbuka.tipe === 'tolak' ? 'Tolak transaksi' : 'Simpan revisi & setujui'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                className="tombol tombol--primer"
                style={{ height: 44 }}
                disabled={prosesId === tx.id}
                onClick={() => kirimAksi(tx.id, 'setujui', {})}
              >
                {prosesId === tx.id ? <span className="spinner" /> : 'Setujui'}
              </button>
              <button className="tombol tombol--sekunder" style={{ height: 44 }} onClick={() => bukaAksi(tx.id, 'revisi')}>
                Revisi
              </button>
              <button className="tombol tombol--bahaya" style={{ height: 44 }} onClick={() => bukaAksi(tx.id, 'tolak')}>
                Tolak
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
