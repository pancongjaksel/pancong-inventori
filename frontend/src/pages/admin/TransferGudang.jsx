import { useEffect, useState } from 'react';
import { api, urlLengkapUpload, ApiError } from '../../api/client';
import UploadFoto from '../../components/UploadFoto';

export default function TransferGudang() {
  const [tab, setTab] = useState('menunggu'); // 'menunggu' | 'kirim-baru'
  const [antrean, setAntrean] = useState([]);
  const [items, setItems] = useState([]);
  const [gudangs, setGudangs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prosesId, setProsesId] = useState(null);

  const [form, setForm] = useState({ itemId: '', gudangAsalId: '', gudangTujuanId: '', jumlah: '', fotoBuktiKirimUrl: '' });
  const [fotoTerimaPerId, setFotoTerimaPerId] = useState({});

  function muatUlang() {
    setLoading(true);
    Promise.all([api.get('/transfer-gudang?status=dikirim'), api.get('/master/items'), api.get('/master/gudangs')])
      .then(([tf, it, gd]) => {
        setAntrean(tf);
        setItems(it);
        setGudangs(gd);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }

  useEffect(muatUlang, []);

  async function kirimTransferBaru(e) {
    e.preventDefault();
    setError(null);
    setProsesId('form');
    try {
      await api.post('/transfer-gudang', {
        itemId: Number(form.itemId),
        gudangAsalId: Number(form.gudangAsalId),
        gudangTujuanId: Number(form.gudangTujuanId),
        jumlah: Number(form.jumlah),
        fotoBuktiKirimUrl: form.fotoBuktiKirimUrl,
      });
      setForm({ itemId: '', gudangAsalId: '', gudangTujuanId: '', jumlah: '', fotoBuktiKirimUrl: '' });
      setTab('menunggu');
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal kirim transfer.');
    } finally {
      setProsesId(null);
    }
  }

  async function terimaTransfer(id) {
    const fotoBuktiTerimaUrl = fotoTerimaPerId[id];
    if (!fotoBuktiTerimaUrl) {
      setError('Isi dulu URL foto bukti terima buat transfer ini.');
      return;
    }
    setError(null);
    setProsesId(id);
    try {
      await api.patch(`/transfer-gudang/${id}/terima`, { fotoBuktiTerimaUrl });
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal konfirmasi terima.');
    } finally {
      setProsesId(null);
    }
  }

  if (loading) return <p style={{ color: 'var(--warna-abu)' }}>Memuat...</p>;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button
          className="tombol tombol--sekunder"
          style={{ width: 'auto', padding: '0 16px', background: tab === 'menunggu' ? 'var(--warna-krim-redup)' : undefined }}
          onClick={() => setTab('menunggu')}
        >
          Menunggu Diterima ({antrean.length})
        </button>
        <button
          className="tombol tombol--sekunder"
          style={{ width: 'auto', padding: '0 16px', background: tab === 'kirim-baru' ? 'var(--warna-krim-redup)' : undefined }}
          onClick={() => setTab('kirim-baru')}
        >
          Kirim Baru
        </button>
      </div>

      {tab === 'menunggu' && (
        <>
          {antrean.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--warna-abu)', marginTop: 40 }}>Gak ada transfer yang lagi nunggu diterima.</p>
          )}
          {antrean.map((tf) => (
            <div key={tf.id} className="kartu" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700 }}>{tf.nama_item}</div>
              <div style={{ fontSize: 13, color: 'var(--warna-abu)', marginBottom: 8 }}>
                {tf.nama_gudang_asal} → {tf.nama_gudang_tujuan} · {tf.jumlah} {tf.satuan} · dikirim oleh {tf.dikirim_oleh_nama}
              </div>
              <a href={urlLengkapUpload(tf.foto_bukti_kirim_url)} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--warna-karamel)' }}>
                Lihat foto bukti kirim →
              </a>
              <UploadFoto
                label="Foto bukti terima"
                value={fotoTerimaPerId[tf.id] || ''}
                onChange={(url) => setFotoTerimaPerId((prev) => ({ ...prev, [tf.id]: url }))}
              />
              <button className="tombol tombol--primer" style={{ height: 44 }} disabled={prosesId === tf.id} onClick={() => terimaTransfer(tf.id)}>
                {prosesId === tf.id ? <span className="spinner" /> : 'Konfirmasi diterima'}
              </button>
            </div>
          ))}
        </>
      )}

      {tab === 'kirim-baru' && (
        <form onSubmit={kirimTransferBaru}>
          <div className="field">
            <label className="label">Item</label>
            <select className="input-teks" value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))} required>
              <option value="">Pilih item</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.nama}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Gudang asal</label>
            <select className="input-teks" value={form.gudangAsalId} onChange={(e) => setForm((f) => ({ ...f, gudangAsalId: e.target.value }))} required>
              <option value="">Pilih gudang asal</option>
              {gudangs.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Gudang tujuan</label>
            <select className="input-teks" value={form.gudangTujuanId} onChange={(e) => setForm((f) => ({ ...f, gudangTujuanId: e.target.value }))} required>
              <option value="">Pilih gudang tujuan</option>
              {gudangs.filter((g) => String(g.id) !== form.gudangAsalId).map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Jumlah</label>
            <input type="number" className="input-teks" value={form.jumlah} onChange={(e) => setForm((f) => ({ ...f, jumlah: e.target.value }))} required />
          </div>
          <UploadFoto
            label="Foto bukti kirim"
            value={form.fotoBuktiKirimUrl}
            onChange={(url) => setForm((f) => ({ ...f, fotoBuktiKirimUrl: url }))}
          />
          <button type="submit" className="tombol tombol--primer" disabled={prosesId === 'form'}>
            {prosesId === 'form' ? <span className="spinner" /> : 'Kirim'}
          </button>
        </form>
      )}
    </div>
  );
}
