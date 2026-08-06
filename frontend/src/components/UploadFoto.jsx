import { useState } from 'react';
import { uploadFoto, urlLengkapUpload, ApiError } from '../api/client';

/**
 * @param {string} value - url relatif hasil upload sebelumnya (kalau ada)
 * @param {(url: string) => void} onChange - dipanggil dengan url relatif setelah upload sukses
 */
export default function UploadFoto({ value, onChange, label = 'Foto bukti' }) {
  const [mengupload, setMengupload] = useState(false);
  const [error, setError] = useState(null);

  async function handlePilihFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setMengupload(true);
    try {
      const url = await uploadFoto(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal upload foto.');
    } finally {
      setMengupload(false);
      e.target.value = ''; // biar bisa pilih file yang sama lagi kalau mau ganti
    }
  }

  return (
    <div className="field">
      <label className="label">{label}</label>

      {value && !mengupload && (
        <div style={{ marginBottom: 8 }}>
          <img
            src={urlLengkapUpload(value)}
            alt="Preview foto bukti"
            style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: '1.5px solid var(--warna-garis)' }}
          />
        </div>
      )}

      <label
        className="tombol tombol--sekunder"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        {mengupload ? <span className="spinner" /> : value ? 'Ganti foto' : '📷 Ambil/pilih foto'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePilihFile}
          disabled={mengupload}
          style={{ display: 'none' }}
        />
      </label>

      {error && <div className="pesan-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
