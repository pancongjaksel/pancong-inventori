export default function VendorField({ vendors, vendorId, setVendorId, vendorBaru, setVendorBaru }) {
  const vendorBaruDipilih = vendorId === '__baru__';
  return (
    <div className="field">
      <label className="label">Vendor/toko</label>
      <select className="input-teks" value={vendorId} onChange={(e) => { setVendorId(e.target.value); if (e.target.value !== '__baru__') setVendorBaru(''); }}>
        <option value="">Pilih vendor</option>
        {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.nama}</option>)}
        <option value="__baru__">Vendor baru…</option>
      </select>
      {vendorBaruDipilih && (
        <input className="input-teks" value={vendorBaru} maxLength="150" placeholder="Tulis nama vendor baru" onChange={(e) => setVendorBaru(e.target.value)} style={{ marginTop: 8 }} />
      )}
      <div style={{ fontSize: 11, color: 'var(--warna-abu)', marginTop: 5 }}>Vendor baru akan tersedia di dropdown untuk input berikutnya.</div>
    </div>
  );
}
