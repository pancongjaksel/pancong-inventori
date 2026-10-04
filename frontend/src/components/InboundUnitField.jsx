export default function InboundUnitField({ item, value, onChange }) {
  if (item?.kode_barang === 'X-004') {
    return (
      <select className="input-teks" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="Slop">Slop (8 balok @ 250 gr)</option>
        <option value="Balok 250 gr">Balok 250 gr</option>
      </select>
    );
  }
  return <input className="input-teks" value={value} onChange={(e) => onChange(e.target.value)} />;
}
