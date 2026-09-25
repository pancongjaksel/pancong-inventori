import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

function rupiah(nilai) {
  return `Rp ${Number(nilai).toLocaleString('id-ID')}`;
}

function tanggalFormatted(tgl) {
  if (!tgl) return '-';
  const d = new Date(String(tgl).includes('T') ? tgl : `${tgl}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function waktuFormatted(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
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
  const [editHarga, setEditHarga] = useState(false);
  const [hargaDraft, setHargaDraft] = useState({});
  const [menyimpanHarga, setMenyimpanHarga] = useState(false);
  const [editSumber, setEditSumber] = useState(false);
  const [sumberDraft, setSumberDraft] = useState('');
  const [menyimpanSumber, setMenyimpanSumber] = useState(false);
  const bisaUbahHarga = nota?.izinUbahHarga === true;
  const bisaUbahSumber = nota?.izinUbahSumber === true;

  async function muatNota() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/barang-masuk-nota/${id}`);
      setNota(data);
      setHargaDraft(Object.fromEntries((data.items ?? []).map((item) => [item.item_row_id, item.harga_beli ?? ''])));
      setSumberDraft(data.sumber ?? '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat detail nota.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { muatNota(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function simpanHarga() {
    const perubahan = (nota.items ?? [])
      .filter((item) => String(hargaDraft[item.item_row_id] ?? '') !== String(item.harga_beli ?? ''))
      .map((item) => ({ itemRowId: item.item_row_id, hargaBeli: hargaDraft[item.item_row_id] }));
    if (perubahan.length === 0) {
      setError('Belum ada harga yang diubah.');
      return;
    }
    if (perubahan.some((item) => item.hargaBeli === '' || Number(item.hargaBeli) <= 0)) {
      setError('Harga beli yang diubah harus lebih dari Rp 0.');
      return;
    }

    setMenyimpanHarga(true);
    setError(null);
    try {
      await api.patch(`/barang-masuk-nota/${id}/harga`, { items: perubahan });
      setEditHarga(false);
      await muatNota();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan harga beli.');
    } finally {
      setMenyimpanHarga(false);
    }
  }

  async function simpanSumber() {
    if (!sumberDraft.trim()) {
      setError('Nama toko atau vendor wajib diisi.');
      return;
    }
    setMenyimpanSumber(true);
    setError(null);
    try {
      await api.patch(`/barang-masuk-nota/${id}/sumber`, { sumber: sumberDraft });
      setEditSumber(false);
      await muatNota();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan asal toko atau vendor.');
    } finally {
      setMenyimpanSumber(false);
    }
  }

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
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Asal toko/vendor</div>
            {!editSumber ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: nota.sumber ? 'var(--warna-arang)' : 'var(--warna-abu)' }}>{nota.sumber || 'Belum diisi'}</div>
                {bisaUbahSumber && nota.status_verifikasi === 'terverifikasi' && (
                  <button onClick={() => setEditSumber(true)} style={{ marginTop: 6, padding: 0, border: 'none', background: 'none', color: 'var(--warna-karamel)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{nota.sumber ? 'Ubah vendor' : 'Lengkapi vendor'}</button>
                )}
              </>
            ) : (
              <>
                <input className="input-teks" value={sumberDraft} maxLength="150" autoFocus onChange={(e) => setSumberDraft(e.target.value)} placeholder="Contoh: Pancasari" style={{ width: '100%', marginTop: 2 }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
                  <button className="tombol tombol--sekunder" style={{ width: 'auto', padding: '0 10px' }} onClick={() => { setEditSumber(false); setSumberDraft(nota.sumber ?? ''); }}>Batal</button>
                  <button className="tombol tombol--primer" style={{ width: 'auto', padding: '0 10px' }} onClick={simpanSumber} disabled={menyimpanSumber}>{menyimpanSumber ? <span className="spinner" /> : 'Simpan'}</button>
                </div>
              </>
            )}
          </div>
          <InfoRow label="Diinput Oleh" value={inputOleh} />
          <InfoRow label="Role Input" value={nota.diinput_oleh_role} />
          <InfoRow label="Waktu Input" value={waktuFormatted(nota.created_at)} />
          {nota.diverifikasi_oleh_nama && (
            <InfoRow label="Diverifikasi Oleh" value={nota.diverifikasi_oleh_nama} />
          )}
          {nota.tanggal_verifikasi && (
            <InfoRow label="Waktu Verifikasi" value={waktuFormatted(nota.tanggal_verifikasi)} />
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
        {bisaUbahHarga && nota.status_verifikasi === 'terverifikasi' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--warna-abu)' }}>Harga bisa dilengkapi atau dikoreksi tanpa mengubah stok.</div>
            {!editHarga ? (
              <button className="tombol tombol--sekunder" style={{ width: 'auto', padding: '0 12px', flexShrink: 0 }} onClick={() => setEditHarga(true)}>Edit harga</button>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="tombol tombol--sekunder" style={{ width: 'auto', padding: '0 12px' }} onClick={() => { setEditHarga(false); setHargaDraft(Object.fromEntries(nota.items.map((item) => [item.item_row_id, item.harga_beli ?? '']))); }}>Batal</button>
                <button className="tombol tombol--primer" style={{ width: 'auto', padding: '0 12px' }} onClick={simpanHarga} disabled={menyimpanHarga}>{menyimpanHarga ? <span className="spinner" /> : 'Simpan'}</button>
              </div>
            )}
          </div>
        )}
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
                  {item.harga_beli !== null ? ` · ${rupiah(item.harga_beli)} / ${item.satuan}` : ' · Harga belum diisi'}
                </div>
                {editHarga && (
                  <label style={{ display: 'block', marginTop: 8, fontSize: 11, color: 'var(--warna-abu)' }}>
                    Harga beli per {item.satuan}
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      className="input-teks"
                      value={hargaDraft[item.item_row_id] ?? ''}
                      onChange={(e) => setHargaDraft((draft) => ({ ...draft, [item.item_row_id]: e.target.value }))}
                      style={{ display: 'block', marginTop: 3, maxWidth: 180 }}
                    />
                  </label>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-angka)', fontSize: 16, fontWeight: 700, color: 'var(--warna-arang)' }}>
                  {Number(item.jumlah).toLocaleString('id-ID')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--warna-abu)' }}>{item.satuan}</div>
                {item.harga_beli !== null && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warna-karamel)', marginTop: 4 }}>
                    {rupiah(Number(item.jumlah) * Number(item.harga_beli))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {(nota.riwayatHarga ?? []).length > 0 && (
          <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Riwayat perubahan harga</div>
            {nota.riwayatHarga.map((riwayat) => {
              const item = nota.items.find((baris) => baris.item_row_id === riwayat.item_row_id);
              return (
                <div key={`${riwayat.item_row_id}-${riwayat.created_at}`} style={{ fontSize: 12, padding: '8px 0', borderTop: '1px solid var(--warna-garis)' }}>
                  <strong>{item?.nama_item || 'Barang'}</strong>: {riwayat.harga_sebelum === null ? 'belum diisi' : rupiah(riwayat.harga_sebelum)} → {rupiah(riwayat.harga_sesudah)}<br />
                  <span style={{ color: 'var(--warna-abu)' }}>{riwayat.diubah_oleh_nama} · {waktuFormatted(riwayat.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}

        {(nota.riwayatSumber ?? []).length > 0 && (
          <div style={{ background: 'white', border: '1px solid var(--warna-garis)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warna-abu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Riwayat asal toko/vendor</div>
            {nota.riwayatSumber.map((riwayat) => (
              <div key={riwayat.created_at} style={{ fontSize: 12, padding: '8px 0', borderTop: '1px solid var(--warna-garis)' }}>
                {riwayat.sumber_sebelum || 'belum diisi'} → <strong>{riwayat.sumber_sesudah}</strong><br />
                <span style={{ color: 'var(--warna-abu)' }}>{riwayat.diubah_oleh_nama} · {waktuFormatted(riwayat.created_at)}</span>
              </div>
            ))}
          </div>
        )}

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
