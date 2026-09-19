import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

function tanggalFormatted(tgl) {
  if (!tgl) return '-';
  const d = new Date(tgl + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function StatusBadge({ label, status }) {
  const teks = label || status || '-';
  const isOk = status === 'terverifikasi';
  const isDitolak = status === 'ditolak';
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: isOk ? '#E9F3ED' : isDitolak ? '#FBEAE9' : '#FDF6EC',
      color: isOk ? '#1a5c36' : isDitolak ? 'var(--warna-bahaya)' : '#7A5420',
    }}>
      {teks}
    </span>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warna-arang)' }}>{value}</div>
    </div>
  );
}

export default function RiwayatBarangMasukDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [nota, setNota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function muat() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get(`/barang-masuk-nota/${id}`);
        setNota(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat detail nota.');
      } finally {
        setLoading(false);
      }
    }
    muat();
  }, [id]);

  if (loading) return (
    <div className="admin-page">
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--warna-abu)', fontSize: 14 }}>Memuat...</div>
    </div>
  );

  if (error) return (
    <div className="admin-page">
      <div style={{ padding: 20 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--warna-karamel)', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 16 }}>
          ← Kembali
        </button>
        <div className="pesan-error">{error}</div>
      </div>
    </div>
  );

  if (!nota) return null;

  const inputOleh = nota.diinput_oleh_admin_nama || nota.nama_crew_input || 'Crew';

  return (
    <div className="admin-page">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--warna-garis)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--warna-karamel)', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}
        >
          ←
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--warna-arang)' }}>Nota #{nota.id}</span>
            <StatusBadge label={nota.label_status} status={nota.status_verifikasi} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 2 }}>{tanggalFormatted(nota.tanggal)}</div>
        </div>
      </div>

      <div style={{ padding: '16px 20px', maxWidth: 720 }}>
        {/* Info */}
        <div style={{
          background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12,
          padding: 16, marginBottom: 16,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
        }}>
          <InfoRow label="Gudang" value={nota.nama_gudang} />
          <InfoRow label="Sumber" value={nota.sumber} />
          <InfoRow label="Diinput Oleh" value={inputOleh} />
          <InfoRow label="Role Input" value={nota.diinput_oleh_role} />
          {nota.diverifikasi_oleh_nama && (
            <InfoRow label="Diverifikasi Oleh" value={nota.diverifikasi_oleh_nama} />
          )}
          {nota.catatan_verifikasi && (
            <div style={{ gridColumn: '1 / -1' }}>
              <InfoRow label="Catatan Verifikasi" value={nota.catatan_verifikasi} />
            </div>
          )}
        </div>

        {/* Items */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Barang ({nota.items?.length ?? 0})
        </div>
        <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          {(nota.items ?? []).map((item, i) => (
            <div
              key={item.item_row_id}
              style={{
                padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: i < (nota.items.length - 1) ? '1px solid var(--warna-garis)' : 'none',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--warna-arang)' }}>{item.nama_item}</div>
                <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginTop: 1 }}>
                  {item.kode_barang}
                  {item.harga_beli ? ` · Rp ${Number(item.harga_beli).toLocaleString('id-ID')}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-angka)', fontSize: 16, fontWeight: 700, color: 'var(--warna-arang)' }}>
                  {Number(item.jumlah).toLocaleString('id-ID')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--warna-abu)' }}>{item.satuan}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Foto bukti */}
        {nota.foto_bukti_url && (
          <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Foto Bukti
            </div>
            <img
              src={nota.foto_bukti_url}
              alt="Foto bukti"
              style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--warna-garis)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
