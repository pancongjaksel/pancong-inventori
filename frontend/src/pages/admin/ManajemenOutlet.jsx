import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

export default function ManajemenOutlet() {
  const [outlets, setOutlets] = useState([]);
  const [gudangs, setGudangs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prosesId, setProsesId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nama: '', gudangAsalId: '' });

  function muatUlang() {
    setLoading(true);
    Promise.all([api.get('/master/outlets?semua=true'), api.get('/master/gudangs')])
      .then(([o, g]) => { setOutlets(o); setGudangs(g.filter((x) => x.tipe === 'serving')); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }
  useEffect(muatUlang, []);

  async function toggleAktif(outlet) {
    setProsesId(outlet.id);
    setError(null);
    try {
      await api.patch(`/master/outlets/${outlet.id}`, { aktif: !outlet.aktif });
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal ubah status.');
    } finally {
      setProsesId(null);
    }
  }

  async function tambahOutlet(e) {
    e.preventDefault();
    setProsesId('form');
    setError(null);
    try {
      await api.post('/master/outlets', { nama: form.nama, gudangAsalId: Number(form.gudangAsalId) });
      setForm({ nama: '', gudangAsalId: '' });
      setShowForm(false);
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal tambah outlet.');
    } finally {
      setProsesId(null);
    }
  }

  if (loading) return <p style={{ color: 'var(--warna-abu)' }}>Memuat...</p>;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}

      <button className="tombol tombol--sekunder" style={{ marginBottom: 16 }} onClick={() => setShowForm((s) => !s)}>
        {showForm ? 'Batal' : '+ Tambah outlet baru'}
      </button>

      {showForm && (
        <form onSubmit={tambahOutlet} className="kartu" style={{ marginBottom: 20 }}>
          <div className="field">
            <label className="label">Nama outlet</label>
            <input className="input-teks" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label">Gudang asal (yang melayani outlet ini)</label>
            <select className="input-teks" value={form.gudangAsalId} onChange={(e) => setForm((f) => ({ ...f, gudangAsalId: e.target.value }))} required>
              <option value="">Pilih gudang</option>
              {gudangs.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
            </select>
          </div>
          <button type="submit" className="tombol tombol--primer" disabled={prosesId === 'form'}>
            {prosesId === 'form' ? <span className="spinner" /> : 'Simpan outlet'}
          </button>
        </form>
      )}

      {outlets.map((o) => {
        const namaGudang = gudangs.find((g) => g.id === o.gudang_asal_id)?.nama ?? '—';
        return (
          <div key={o.id} className="kartu" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, opacity: o.aktif ? 1 : 0.5 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{o.nama}</div>
              <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>Dilayani Gudang {namaGudang}</div>
            </div>
            <button
              className="tombol tombol--sekunder"
              style={{ width: 'auto', height: 32, padding: '0 10px', fontSize: 12 }}
              disabled={prosesId === o.id}
              onClick={() => toggleAktif(o)}
            >
              {o.aktif ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
