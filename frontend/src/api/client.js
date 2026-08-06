const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const KEY_ADMIN_TOKEN = 'pj_admin_token';
const KEY_DEVICE_TOKEN = 'pj_device_token';
const KEY_DEVICE_INFO = 'pj_device_info'; // { deviceId, gudangId, namaGudang } - buat ditampilin di UI tanpa fetch ulang

export const authStorage = {
  simpanAdminToken: (token) => localStorage.setItem(KEY_ADMIN_TOKEN, token),
  ambilAdminToken: () => localStorage.getItem(KEY_ADMIN_TOKEN),
  hapusAdminToken: () => localStorage.removeItem(KEY_ADMIN_TOKEN),

  simpanDevice: (deviceToken, info) => {
    localStorage.setItem(KEY_DEVICE_TOKEN, deviceToken);
    localStorage.setItem(KEY_DEVICE_INFO, JSON.stringify(info));
  },
  ambilDeviceToken: () => localStorage.getItem(KEY_DEVICE_TOKEN),
  ambilDeviceInfo: () => {
    const raw = localStorage.getItem(KEY_DEVICE_INFO);
    return raw ? JSON.parse(raw) : null;
  },
  hapusDevice: () => {
    localStorage.removeItem(KEY_DEVICE_TOKEN);
    localStorage.removeItem(KEY_DEVICE_INFO);
  },
};

/**
 * Error yang dilempar kalau API balikin sukses:false. `pesan` udah dalam
 * Bahasa Indonesia siap ditampilkan ke user (dari AppError backend).
 */
export class ApiError extends Error {
  constructor(pesan, kode, status) {
    super(pesan);
    this.kode = kode;
    this.status = status;
  }
}

/**
 * @param {string} path - mis. '/auth/login'
 * @param {object} [options]
 * @param {'admin'|'device'|'none'} [options.auth] - default 'admin' kalau ada token admin, else 'device' kalau ada token device
 */
async function apiFetch(path, { method = 'GET', body, auth } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  const modeAuth = auth ?? (authStorage.ambilAdminToken() ? 'admin' : authStorage.ambilDeviceToken() ? 'device' : 'none');
  if (modeAuth === 'admin' && authStorage.ambilAdminToken()) {
    headers.Authorization = `Bearer ${authStorage.ambilAdminToken()}`;
  } else if (modeAuth === 'device' && authStorage.ambilDeviceToken()) {
    headers['X-Device-Token'] = authStorage.ambilDeviceToken();
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json;
  try {
    json = await response.json();
  } catch {
    throw new ApiError('Server tidak merespons dengan benar. Coba lagi.', 'RESPON_TIDAK_VALID', response.status);
  }

  if (!json.sukses) {
    throw new ApiError(json.pesan || 'Terjadi kesalahan.', json.kode, response.status);
  }

  return json.data;
}

/**
 * Upload foto bukti (multipart/form-data). Otomatis nempelin auth yang lagi
 * aktif (admin atau device, sama kayak apiFetch). Return url RELATIF
 * (mis. '/uploads/xxx.jpg') — gabungin sendiri sama base API kalau perlu
 * ditampilin sebagai <img>/link.
 */
export async function uploadFoto(file) {
  const formData = new FormData();
  formData.append('foto', file);

  const headers = {};
  if (authStorage.ambilAdminToken()) {
    headers.Authorization = `Bearer ${authStorage.ambilAdminToken()}`;
  } else if (authStorage.ambilDeviceToken()) {
    headers['X-Device-Token'] = authStorage.ambilDeviceToken();
  }

  const response = await fetch(`${BASE_URL}/upload`, { method: 'POST', headers, body: formData });
  const json = await response.json();

  if (!json.sukses) {
    throw new ApiError(json.pesan || 'Gagal upload foto.', json.kode, response.status);
  }
  return json.data.url; // '/uploads/xxx.jpg'
}

/** Gabungin url relatif hasil upload jadi URL absolut, buat ditampilin/dibuka. */
export function urlLengkapUpload(urlRelatif) {
  if (!urlRelatif) return '';
  const asalApi = BASE_URL.replace(/\/api\/?$/, ''); // buang '/api' di akhir
  return `${asalApi}${urlRelatif}`;
}
export const api = {
  get: (path, opts) => apiFetch(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiFetch(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => apiFetch(path, { ...opts, method: 'PATCH', body }),
  put: (path, body, opts) => apiFetch(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => apiFetch(path, { ...opts, method: 'DELETE' }),
};

/**
 * Download file dari endpoint yang balikin biner (mis. export .xlsx), BUKAN
 * JSON seperti endpoint lain — makanya gak lewat apiFetch. Otomatis nempelin
 * Authorization header admin, terus trigger download browser lewat elemen
 * <a> sementara.
 */
export async function downloadFile(path, namaFileFallback = 'download') {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${authStorage.ambilAdminToken()}` },
  });

  if (!response.ok) {
    let pesan = 'Gagal download file.';
    try {
      const json = await response.json();
      pesan = json.pesan || pesan;
    } catch {
      // respons error bukan JSON, pakai pesan default
    }
    throw new ApiError(pesan, 'DOWNLOAD_GAGAL', response.status);
  }

  const namaFile = response.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || namaFileFallback;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
