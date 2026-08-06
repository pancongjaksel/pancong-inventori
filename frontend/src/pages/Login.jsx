import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authStorage, ApiError } from '../api/client';
import TopBar from '../components/TopBar';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const hasil = await api.post('/auth/login', { email, password }, { auth: 'none' });
      authStorage.simpanAdminToken(hasil.token);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal login. Cek koneksi internet.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="layar">
      <TopBar judul="Inventori Pancong Jaksel" konteks="Login Admin" />
      <div className="konten">
        <form onSubmit={handleSubmit}>
          {error && <div className="pesan-error">{error}</div>}

          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input-teks"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input-teks"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="tombol tombol--primer" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
