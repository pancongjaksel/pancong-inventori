import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

export default function ManajemenUser() {
  const [users, setUsers] = useState([]);
  const [gudangs, setGudangs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sukses, setSukses] = useState(null);
  const [prosesId, setProsesId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nama: '', email: '', password: '', role: 'admin' });
  const [resetPasswordUserId, setResetPasswordUserId] = useState(null);
  const [passwordBaru, setPasswordBaru] = useState('');

  function muatUlang() {
    setLoading(true);
    Promise.all([api.get('/users'), api.get('/master/gudangs')])
      .then(([u, g]) => { setUsers(u); setGudangs(g); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }
  useEffect(muatUlang, []);

  async function tambahUser(e) {
    e.preventDefault();
    setProsesId('form');
    setError(null);
    try {
      await api.post('/users', form);
      setForm({ nama: '', email: '', password: '', role: 'admin' });
      setShowForm(false);
      setSukses('Akun baru dibuat.');
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal buat akun.');
    } finally {
      setProsesId(null);
    }
  }

  async function toggleAktif(user) {
    setProsesId(user.id);
    setError(null);
    try {
      await api.patch(`/users/${user.id}`, { aktif: !user.aktif });
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal ubah status.');
    } finally {
      setProsesId(null);
    }
  }

  async function submitResetPassword(userId) {
    if (passwordBaru.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    setProsesId(userId);
    setError(null);
    try {
      await api.post(`/users/${userId}/reset-password`, { passwordBaru });
      setSukses('Password berhasil direset.');
      setResetPasswordUserId(null);
      setPasswordBaru('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal reset password.');
    } finally {
      setProsesId(null);
    }
  }

  async function toggleAksesGudang(user, gudangId, punyaAkses) {
    setProsesId(`${user.id}-${gudangId}`);
    setError(null);
    try {
      if (punyaAkses) {
        await api.del(`/users/${user.id}/akses-gudang/${gudangId}`);
      } else {
        await api.post(`/users/${user.id}/akses-gudang`, { gudangId });
      }
      muatUlang();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal ubah akses gudang.');
    } finally {
      setProsesId(null);
    }
  }

  if (loading) return <p style={{ color: 'var(--warna-abu)' }}>Memuat...</p>;

  return (
    <div>
      {error && <div className="pesan-error">{error}</div>}
      {sukses && <div className="pesan-sukses">{sukses}</div>}

      <button className="tombol tombol--sekunder" style={{ marginBottom: 16 }} onClick={() => setShowForm((s) => !s)}>
        {showForm ? 'Batal' : '+ Buat akun baru'}
      </button>

      {showForm && (
        <form onSubmit={tambahUser} className="kartu" style={{ marginBottom: 20 }}>
          <div className="field">
            <label className="label">Nama</label>
            <input className="input-teks" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input type="email" className="input-teks" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label">Password awal</label>
            <input type="password" className="input-teks" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label">Role</label>
            <select className="input-teks" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <button type="submit" className="tombol tombol--primer" disabled={prosesId === 'form'}>
            {prosesId === 'form' ? <span className="spinner" /> : 'Buat akun'}
          </button>
        </form>
      )}

      {users.map((u) => (
        <div key={u.id} className="kartu" style={{ marginBottom: 14, opacity: u.aktif ? 1 : 0.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{u.nama} <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--warna-abu)' }}>({u.role})</span></div>
              <div style={{ fontSize: 13, color: 'var(--warna-abu)' }}>{u.email}</div>
            </div>
            <button
              className="tombol tombol--sekunder"
              style={{ width: 'auto', height: 32, padding: '0 10px', fontSize: 12 }}
              disabled={prosesId === u.id}
              onClick={() => toggleAktif(u)}
            >
              {u.aktif ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>

          {u.role === 'admin' && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--warna-garis)' }}>
              <p style={{ fontSize: 12, color: 'var(--warna-abu)', marginBottom: 6 }}>Akses gudang:</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {gudangs.map((g) => {
                  const punyaAkses = u.akses_gudang.includes(g.nama);
                  return (
                    <button
                      key={g.id}
                      className="tombol tombol--sekunder"
                      style={{
                        width: 'auto', height: 30, padding: '0 10px', fontSize: 12,
                        background: punyaAkses ? 'var(--warna-karamel)' : undefined,
                        color: punyaAkses ? 'var(--warna-krim)' : undefined,
                      }}
                      disabled={prosesId === `${u.id}-${g.id}`}
                      onClick={() => toggleAksesGudang(u, g.id, punyaAkses)}
                    >
                      {g.nama}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            {resetPasswordUserId === u.id ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  className="input-teks"
                  style={{ height: 36 }}
                  placeholder="Password baru (min 8 karakter)"
                  value={passwordBaru}
                  onChange={(e) => setPasswordBaru(e.target.value)}
                />
                <button className="tombol tombol--primer" style={{ width: 'auto', height: 36, padding: '0 12px', fontSize: 13 }} onClick={() => submitResetPassword(u.id)}>
                  Simpan
                </button>
              </div>
            ) : (
              <button
                className="tombol tombol--sekunder"
                style={{ width: 'auto', height: 30, padding: '0 10px', fontSize: 12 }}
                onClick={() => { setResetPasswordUserId(u.id); setPasswordBaru(''); }}
              >
                Reset password
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
