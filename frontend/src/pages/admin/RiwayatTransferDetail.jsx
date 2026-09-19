import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

function waktuFormatted(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · '
    + new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ label, status }) {
  const teks = label || status || '-';
  const isDiterima = status === 'diterima' || teks === 'Diterima';
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: isDiterima ? '#E9F3ED' : '#FDF6EC',
      color: isDiterima ? '#1a5c36' : '#7A5420',
    }}>
      {teks}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warna-arang)' }}>{value || '-'}</div>
    </div>
  );
}

export default function RiwayatTransferDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function muat() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get(`/transfer-gudang/${id}`);
        setTransfer(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat detail transfer.');
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

  if (!transfer) return null;

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
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--warna-arang)' }}>Pemindahan #{transfer.id}</span>
            <StatusBadge label={transfer.label_status} status={transfer.status} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 2 }}>{waktuFormatted(transfer.tanggal_kirim)}</div>
        </div>
      </div>

      <div style={{ padding: '16px 20px', maxWidth: 720 }}>
        {/* Item */}
        <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Item</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--warna-arang)' }}>{transfer.nama_item}</div>
              <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 1 }}>{transfer.kode_barang}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-angka)', fontSize: 22, fontWeight: 800, color: 'var(--warna-arang)' }}>
                {Number(transfer.jumlah).toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>{transfer.satuan}</div>
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div style={{
          background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12,
          padding: 16, marginBottom: 16,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
        }}>
          <InfoRow label="Dari Gudang" value={transfer.nama_gudang_asal} />
          <InfoRow label="Ke Gudang" value={transfer.nama_gudang_tujuan} />
          <InfoRow label="Dikirim Oleh" value={transfer.dikirim_oleh_nama} />
          <InfoRow label="Tanggal Kirim" value={transfer.tanggal_kirim ? new Date(transfer.tanggal_kirim).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'} />
          {transfer.diterima_oleh_nama && (
            <InfoRow label="Diterima Oleh" value={transfer.diterima_oleh_nama} />
          )}
          {transfer.tanggal_terima && (
            <InfoRow label="Tanggal Terima" value={new Date(transfer.tanggal_terima).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} />
          )}
        </div>

        {/* Foto bukti kirim */}
        {transfer.foto_bukti_kirim_url && (
          <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Foto Bukti Kirim
            </div>
            <img
              src={transfer.foto_bukti_kirim_url}
              alt="Bukti kirim"
              style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--warna-garis)' }}
            />
          </div>
        )}

        {/* Foto bukti terima */}
        {transfer.foto_bukti_terima_url && (
          <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Foto Bukti Terima
            </div>
            <img
              src={transfer.foto_bukti_terima_url}
              alt="Bukti terima"
              style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--warna-garis)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
