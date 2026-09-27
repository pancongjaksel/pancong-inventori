function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function InboundUnitHint({ item, jumlah, satuan }) {
  const conversion = (item?.konversi_penerimaan || []).find(
    (row) => normalize(row.satuan_beli) === normalize(satuan),
  );
  const qty = Number(jumlah);
  if (!conversion || !Number.isFinite(qty) || qty <= 0) return null;

  const stok = qty * Number(conversion.faktor_ke_stok);
  return (
    <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--warna-abu)' }}>
      Stok gudang: {stok.toLocaleString('id-ID')} {item?.satuan} ({qty.toLocaleString('id-ID')} {satuan} = {stok.toLocaleString('id-ID')} {item?.satuan})
    </p>
  );
}
