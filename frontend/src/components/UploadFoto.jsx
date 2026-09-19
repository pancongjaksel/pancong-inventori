import { useState } from 'react';
import { uploadFoto, urlLengkapUpload, ApiError } from '../api/client';

const SISI_MAKS = 1600; // cukup buat foto bukti nota, gak perlu resolusi penuh kamera HP
const BATAS_KOMPRES_ULANG = 2 * 1024 * 1024; // kalau hasil kompres masih di atas ini, turunkan quality 1x lagi

/**
 * Resize + compress foto ke JPEG sebelum upload, biar gak sering kena limit
 * ukuran file. HEIC/HEIF DI-SKIP total (langsung return file asli) karena
 * kebanyakan browser Android/desktop gak bisa decode HEIC lewat Canvas API —
 * memaksakannya cuma bikin createImageBitmap() throw. Kalau proses kompresi
 * gagal karena alasan apapun juga, fallback ke file asli — fitur kompresi ini
 * TIDAK BOLEH jadi alasan submit gagal.
 */
async function kompresGambar(file) {
  const kemungkinanHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (kemungkinanHeic) return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    let { width, height } = bitmap;
    if (width > SISI_MAKS || height > SISI_MAKS) {
      if (width > height) {
        height = Math.round((height / width) * SISI_MAKS);
        width = SISI_MAKS;
      } else {
        width = Math.round((width / height) * SISI_MAKS);
        height = SISI_MAKS;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let kualitas = 0.8;
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', kualitas));
    if (blob && blob.size > BATAS_KOMPRES_ULANG) {
      kualitas = 0.6;
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', kualitas));
    }
    if (!blob) return file;

    const namaBaru = file.name.replace(/\.[^./]+$/, '') + '.jpg';
    return new File([blob], namaBaru, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

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
      const fileUntukUpload = await kompresGambar(file);
      const url = await uploadFoto(fileUntukUpload);
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
          onChange={handlePilihFile}
          disabled={mengupload}
          style={{ display: 'none' }}
        />
      </label>

      {error && <div className="pesan-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
