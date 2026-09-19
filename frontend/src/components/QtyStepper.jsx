import { useState, useEffect } from 'react';

const STEPPER_STYLE = {
  wrap: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'var(--warna-krim-redup)', borderRadius: 12, padding: 4,
  },
  tombol: {
    width: 40, height: 40, borderRadius: 10, border: 'none',
    background: 'white', fontSize: 20, fontWeight: 700,
    color: 'var(--warna-karamel)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  input: {
    width: 56, height: 40, textAlign: 'center', border: 'none',
    background: 'transparent', fontFamily: 'var(--font-angka)',
    fontSize: 16, fontWeight: 700, color: 'var(--warna-arang)',
    MozAppearance: 'textfield',
  },
};

export default function QtyStepper({ value, onChange, min = 0, max = 9999 }) {
  const [lokal, setLokal] = useState(String(value));

  // Sync kalau parent update value dari luar (misal prefill)
  useEffect(() => { setLokal(String(value)); }, [value]);

  const commit = (raw) => {
    const parsed = parseInt(raw, 10);
    const valid = Number.isFinite(parsed)
      ? Math.min(max, Math.max(min, parsed))
      : min;
    setLokal(String(valid));
    onChange(valid);
  };

  return (
    <div style={STEPPER_STYLE.wrap}>
      <button type="button" style={STEPPER_STYLE.tombol}
        onClick={() => commit(value - 1)} disabled={value <= min} aria-label="Kurangi">−</button>

      <input
        type="number"
        inputMode="numeric"
        style={STEPPER_STYLE.input}
        value={lokal}
        min={min}
        max={max}
        onChange={e => setLokal(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && commit(e.target.value)}
      />

      <button type="button" style={STEPPER_STYLE.tombol}
        onClick={() => commit(value + 1)} disabled={value >= max} aria-label="Tambah">+</button>
    </div>
  );
}
