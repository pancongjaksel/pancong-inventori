import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Menjaga filter daftar di query string. Draft berubah saat pengguna mengetik;
 * URL baru diperbarui setelah filter diterapkan, sehingga tombol Back tetap
 * kembali ke daftar dengan filter yang sama.
 */
export function useUrlFilterDraft(fields) {
  const [searchParams, setSearchParams] = useSearchParams();
  const parameterKey = searchParams.toString();
  const filters = useMemo(() => Object.fromEntries(fields.map(({ key, defaultValue = '' }) => [
    key,
    searchParams.get(key) ?? defaultValue,
  ])), [fields, parameterKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState(filters);

  useEffect(() => { setDraft(filters); }, [filters]);

  const terapkan = useCallback((nilai = draft) => {
    const berikutnya = new URLSearchParams();
    fields.forEach(({ key, defaultValue = '' }) => {
      const value = String(nilai[key] ?? '').trim();
      if (value && value !== defaultValue) berikutnya.set(key, value);
    });
    setSearchParams(berikutnya);
  }, [draft, fields, setSearchParams]);

  const reset = useCallback(() => {
    const kosong = Object.fromEntries(fields.map(({ key, defaultValue = '' }) => [key, defaultValue]));
    setDraft(kosong);
    setSearchParams(new URLSearchParams());
  }, [fields, setSearchParams]);

  const adaFilter = fields.some(({ key, defaultValue = '' }) => filters[key] !== defaultValue);
  return { draft, setDraft, filters, terapkan, reset, adaFilter };
}

export function alamatKembali(location) {
  return `${location.pathname}${location.search}`;
}
