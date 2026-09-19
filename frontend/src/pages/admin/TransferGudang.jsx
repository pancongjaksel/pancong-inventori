import { useEffect, useState } from 'react';
import { api, urlLengkapUpload, ApiError, authStorage } from '../../api/client';
import UploadFoto from '../../components/UploadFoto';

export default function TransferGudang() {
  const adalahOwner = authStorage.ambilAdminRole() === 'owner';
  const [tab, setTab] = useState('menunggu');
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
    if (!adalahOwner && !fotoBuktiTerimaUrl) {
      setError('Upload dulu foto bukti terima untuk transfer ini.');
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

  const bisaKirimForm = form.itemId && form.gudangAsalId && form.gudangTujuanId
    && Number(form.jumlah) > 0
    && form.fotoBuktiKirimUrl;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}

      <div className="transfer-tab-group">
        <button
          className={`transfer-tab${tab === 'menunggu' ? ' transfer-tab--aktif' : ''}`}
          onClick={() => setTab('menunggu')}
        >
          Menunggu Diterima{antrean.length > 0 ? ` (${antrean.length})` : ''}
        </button>
        <button
          className={`transfer-tab${tab === 'kirim-baru' ? ' transfer-tab--aktif' : ''}`}
          onClick={() => setTab('kirim-baru')}
        >
          Kirim Baru
        </button>
      </div>

      {tab === 'menunggu' && (
        <>
          {antrean.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--warna-abu)', marginTop: 40 }}>
              Gak ada transfer yang lagi nunggu diterima.
            </p>
          )}
          {antrean.map((tf) => (
            <div key={tf.id} className="kartu" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{tf.nama_item}</div>

              {/* Rute pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 10 }}>
                <span style={{ background: 'var(--warna-krim-redup)', border: '1px solid var(--warna-garis)', borderRadius: 999, padding: '2px 10px', fontWeight: 600 }}>
                  {tf.nama_gudang_asal}
                </span>
                <span style={{ color: 'var(--warna-abu)' }}>→</span>
                <span style={{ background: 'var(--warna-krim-redup)', border: '1px solid var(--warna-garis)', borderRadius: 999, padding: '2px 10px', fontWeight: 600 }}>
                  {tf.nama_gudang_tujuan}
                </span>
              </div>

              {/* Ringkasan qty + pengirim */}
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font-angka)', fontWeight: 700, fontSize: 15 }}>
                  {tf.jumlah} {tf.satuan}
                </span>
                <span style={{ color: 'var(--warna-abu)', marginLeft: 8 }}>· dikirim oleh {tf.dikirim_oleh_nama}</span>
              </div>

              <a
                href={urlLengkapUpload(tf.foto_bukti_kirim_url)}
                target="_blank"
                rel="noreferrer"
                className="verifikasi-foto-link"
                style={{ marginBottom: 12 }}
              >
                Foto bukti kirim →
              </a>

              <UploadFoto
                label={adalahOwner ? 'Foto bukti terima (opsional untuk Owner)' : 'Foto bukti terima'}
                value={fotoTerimaPerId[tf.id] || ''}
                onChange={(url) => setFotoTerimaPerId((prev) => ({ ...prev, [tf.id]: url }))}
              />

              <button
                className="tombol tombol--primer"
                style={{ height: 44 }}
                disabled={(!adalahOwner && !fotoTerimaPerId[tf.id]) || prosesId === tf.id}
                onClick={() => terimaTransfer(tf.id)}
              >
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
          <button type="submit" className="tombol tombol--primer" disabled={!bisaKirimForm || prosesId === 'form'} style={{ marginTop: 8 }}>
            {prosesId === 'form' ? <span className="spinner" /> : 'Kirim transfer'}
          </button>
        </form>
      )}
    </div>
  );
}
