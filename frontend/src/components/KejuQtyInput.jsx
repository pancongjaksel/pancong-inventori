/** Input ramah operasional: Crew tetap berpikir dalam slop, sistem menyimpan balok. */
export function formatKeju(qty) {
  const total = Math.max(0, Number(qty) || 0);
  const slop = Math.floor(total / 8);
  const balok = total % 8;
  if (!slop) return `${balok} balok`;
  if (!balok) return `${slop} slop`;
  return `${slop} slop + ${balok} balok`;
}

export default function KejuQtyInput({ value, onChange, disabled = false, compact = false }) {
  const total = Math.max(0, Number(value) || 0);
  const slop = Math.floor(total / 8);
  const balok = total % 8;
  const angkaUtuh = (raw) => Math.max(0, Math.trunc(Number(raw || 0)));
  const ubahSlop = (raw) => onChange(angkaUtuh(raw) * 8 + balok);
  const ubahBalok = (raw) => onChange(slop * 8 + Math.min(7, angkaUtuh(raw)));
  const inputStyle = {
    width: '100%', minWidth: 0, height: compact ? 36 : 42, borderRadius: 8,
    border: '1px solid var(--warna-garis)', padding: '0 8px', textAlign: 'center',
    fontFamily: 'var(--font-angka)', fontSize: compact ? 15 : 16, fontWeight: 700,
  };

  return (
    <div style={{ minWidth: compact ? 120 : 176 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <label style={{ fontSize: 10, color: 'var(--warna-abu)', fontWeight: 700 }}>
          SLOP
          <input type="number" min="0" step="1" value={slop} disabled={disabled} onChange={(e) => ubahSlop(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: 10, color: 'var(--warna-abu)', fontWeight: 700 }}>
          BALOK
          <input type="number" min="0" max="7" step="1" value={balok} disabled={disabled} onChange={(e) => ubahBalok(e.target.value)} style={inputStyle} />
        </label>
      </div>
      {!compact && <div style={{ marginTop: 5, fontSize: 11, color: 'var(--warna-abu)' }}>1 slop = 8 balok 250gr</div>}
    </div>
  );
}
