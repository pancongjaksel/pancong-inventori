/**
 * Keju disimpan dalam satuan stok dasar: balok 250gr (X-004).
 * X-002 tetap dipertahankan untuk membaca transaksi lama, tetapi setiap
 * request baru dari PWA lama dinormalisasi sebelum menyentuh stok/ledger.
 */
async function petaKeju(client) {
  const { rows } = await client.query(
    `SELECT id, kode_barang FROM item WHERE kode_barang IN ('X-002', 'X-004')`
  );
  const slop = rows.find((row) => row.kode_barang === 'X-002');
  const balok = rows.find((row) => row.kode_barang === 'X-004');
  if (!slop || !balok) throw new Error('Master item Keju belum lengkap.');
  return { slopId: Number(slop.id), balokId: Number(balok.id) };
}

async function normalisasiDaftarKeju(client, daftarItem) {
  const { slopId, balokId } = await petaKeju(client);
  const gabungan = new Map();
  for (const row of daftarItem) {
    const itemId = Number(row.itemId);
    const qty = Number(row.qty);
    const targetItemId = itemId === slopId ? balokId : itemId;
    const targetQty = itemId === slopId ? qty * 8 : qty;
    gabungan.set(targetItemId, (gabungan.get(targetItemId) || 0) + targetQty);
  }
  return [...gabungan].map(([itemId, qty]) => ({ itemId, qty }));
}

async function normalisasiItemMasukKeju(client, item) {
  const { slopId, balokId } = await petaKeju(client);
  if (Number(item.itemId) !== slopId) return item;
  return { ...item, itemId: balokId, satuan: 'Slop' };
}

async function normalisasiTransferKeju(client, { itemId, qty, satuanInput }) {
  const { slopId, balokId } = await petaKeju(client);
  const unit = String(satuanInput || '').trim().toLowerCase();
  if (Number(itemId) === slopId) return { itemId: balokId, qty: Number(qty) * 8, satuanInput: 'Slop' };
  if (Number(itemId) !== balokId) return { itemId: Number(itemId), qty: Number(qty), satuanInput: satuanInput || null };
  if (unit === 'slop') return { itemId: balokId, qty: Number(qty) * 8, satuanInput: 'Slop' };
  return { itemId: balokId, qty: Number(qty), satuanInput: 'Balok 250 gr' };
}

module.exports = { normalisasiDaftarKeju, normalisasiItemMasukKeju, normalisasiTransferKeju };
