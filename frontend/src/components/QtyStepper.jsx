const STEPPER_STYLE = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--warna-krim-redup)',
    borderRadius: 12,
    padding: 4,
  },
  tombol: {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: 'none',
    background: 'white',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--warna-karamel)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  angka: {
    minWidth: 36,
    textAlign: 'center',
    fontFamily: 'var(--font-angka)',
    fontSize: 16,
    fontWeight: 700,
  },
};

export default function QtyStepper({ value, onChange, min = 0, max = 9999 }) {
  const kurangi = () => onChange(Math.max(min, value - 1));
  const tambah = () => onChange(Math.min(max, value + 1));

  return (
    <div style={STEPPER_STYLE.wrap}>
      <button type="button" style={STEPPER_STYLE.tombol} onClick={kurangi} disabled={value <= min} aria-label="Kurangi">
        −
      </button>
      <span style={STEPPER_STYLE.angka}>{value}</span>
      <button type="button" style={STEPPER_STYLE.tombol} onClick={tambah} disabled={value >= max} aria-label="Tambah">
        +
      </button>
    </div>
  );
}
