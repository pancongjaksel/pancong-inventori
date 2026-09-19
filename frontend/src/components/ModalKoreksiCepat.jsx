import { useState } from 'react';
import { api, ApiError } from '../api/client';

/**
 * @param {number} sesiPengambilanItemId
 * @param {string} itemNama
 * @param {number} qtySekarang
 * @param {string} satuan
 * @param {() => void} onClose
 * @param {() => void} [onSukses] - dipanggil setelah koreksi berhasil (biar pemanggil bisa refresh data terkait)
 */
export default function ModalKoreksiCepat({ sesiPengambilanItemId, itemNama, qtySekarang, satuan, onClose, onSukses }) {
  const [qtyBaru, setQtyBaru] = useState(String(qtySekarang));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [perluKonfirmasiOpname, setPerluKonfirmasiOpname] = useState(false);
  const [sukses, setSukses] = useState(false);

  async function submit(konfirmasiMeskiAdaOpname) {
    setError(null);
    setLoading(true);
    try {
      await api.patch('/laporan/koreksi-cepat-item', {
        sesi_pengambilan_item_id: sesiPengambilanItemId,
        qty_baru: Number(qtyBaru),
        konfirmasi_meski_ada_opname: konfirmasiMeskiAdaOpname,
      });
      setSukses(true);
      onSukses?.();
    } catch (err) {
      if (err instanceof ApiError && err.kode === 'PERLU_KONFIRMASI_OPNAME') {
        setPerluKonfirmasiOpname(true);
        setError(err.message);
      } else {
        setPerluKonfirmasiOpname(false);
        setError(err instanceof ApiError ? err.message : 'Gagal menyimpan koreksi.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const angka = Number(qtyBaru);
    if (!Number.isFinite(angka) || angka <= 0) {
      setError('Qty harus angka lebih besar dari 0.');
      return;
    }
    submit(false);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(43, 35, 32, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div className="kartu" style={{ width: '100%', maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        {sukses ? (
          <>
            <div className="pesan-sukses" style={{ marginBottom: 12 }}>
              Berhasil dikoreksi: {itemNama} &rarr; {Number(qtyBaru).toLocaleString('id-ID')} {satuan}
            </div>
            <button className="tombol tombol--sekunder" onClick={onClose}>Tutup</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ fontWeight: 700, marginTop: 0, marginBottom: 4 }}>Koreksi Cepat</p>
            <p style={{ fontSize: 13, color: 'var(--warna-abu)', marginTop: 0, marginBottom: 16 }}>
              {itemNama} &mdash; qty sekarang: {Number(qtySekarang).toLocaleString('id-ID')} {satuan}
            </p>

            {error && <div className="pesan-error">{error}</div>}

            <div className="field">
              <label className="label" htmlFor="qty-baru">Qty baru ({satuan})</label>
              <input
                id="qty-baru"
                type="number"
                min="0.01"
                step="0.01"
                className="input-teks"
                value={qtyBaru}
                onChange={(e) => setQtyBaru(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="tombol tombol--sekunder" onClick={onClose} disabled={loading}>
                Batal
              </button>
              {perluKonfirmasiOpname ? (
                <button
                  type="button"
                  className="tombol tombol--bahaya"
                  disabled={loading}
                  onClick={() => submit(true)}
                >
                  {loading ? <span className="spinner" /> : 'Tetap Koreksi'}
                </button>
              ) : (
                <button type="submit" className="tombol tombol--primer" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Simpan'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
