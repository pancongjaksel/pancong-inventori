import { useState, useEffect } from 'react';
import { api, authStorage } from '../../api/client';
import styles from './StokOpname.module.css';

export default function StokOpname() {
  const isAdminGudang = authStorage.ambilDeviceRole() === 'admin_gudang';

  const [lokasiTipe, setLokasiTipe] = useState('gudang');
  const [gudangs, setGudangs] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [selectedGudangId, setSelectedGudangId] = useState('');
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [periode, setPeriode] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [tanggal, setTanggal] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [jenisOpname, setJenisOpname] = useState('bulanan');
  const [tipeOpname, setTipeOpname] = useState('akhir');
  const [items, setItems] = useState([]);
  const [opnameData, setOpnameData] = useState({});
  const [stokSistemMap, setStokSistemMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [ringkasanSubmit, setRingkasanSubmit] = useState(null);
  const [pecahanInput, setPecahanInput] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const gudangList = await api.get('/master/gudangs');
        setGudangs(gudangList || []);
        if (gudangList?.length > 0) {
          setSelectedGudangId(gudangList[0].id);
        }

        const outletList = await api.get('/master/outlets');
        setOutlets(outletList || []);
        if (outletList?.length > 0) {
          setSelectedOutletId(outletList[0].id);
        }
      } catch (err) {
        setError('Gagal muat daftar gudang/outlet: ' + (err.message || ''));
      }
    })();
  }, []);

  useEffect(() => {
    if (!periode || (lokasiTipe === 'gudang' && !selectedGudangId) || (lokasiTipe === 'outlet' && !selectedOutletId)) {
      return;
    }

    (async () => {
      setLoading(true);
      setError('');
      try {
        const endpointItems = lokasiTipe === 'gudang' && selectedGudangId
          ? `/master/items?gudang_id=${selectedGudangId}`
          : '/master/items';
        const itemList = await api.get(endpointItems);
        setItems(itemList || []);
        setOpnameData({});
        setPecahanInput({});
        setRingkasanSubmit(null);

        if (lokasiTipe === 'gudang' && selectedGudangId) {
          const stokRows = await api.get(`/laporan/stok-saat-ini?gudang_id=${selectedGudangId}`);
          const peta = {};
          (stokRows || []).forEach((r) => {
            peta[r.item_id] = Number(r.stok_saat_ini);
          });
          setStokSistemMap(peta);
        } else {
          setStokSistemMap({});
        }
      } catch (err) {
        setError('Gagal muat daftar item: ' + (err.message || ''));
      } finally {
        setLoading(false);
      }
    })();
  }, [lokasiTipe, selectedGudangId, selectedOutletId, periode]);

  function handleStokFisikChange(itemId, value) {
    setOpnameData((prev) => ({
      ...prev,
      [itemId]: value === '' ? undefined : Math.max(0, Number(value) || 0),
    }));
  }

  function parseFaktorSatuan(satuan) {
    const cocok = /^(\d+)\s*([a-zA-Z]+)$/.exec((satuan || '').trim());
    if (!cocok) return null;
    return { faktor: Number(cocok[1]), labelKecil: cocok[2] };
  }

  function handlePecahanChange(itemId, field, value) {
    const current = pecahanInput[itemId] || { packUtuh: '', sisaKecil: '' };
    const next = { ...current, [field]: value };
    setPecahanInput((prev) => ({ ...prev, [itemId]: next }));

    const item = items.find((i) => i.id === itemId);
    const faktorInfo = parseFaktorSatuan(item?.satuan);
    const faktor = faktorInfo?.faktor || 1;

    const packUtuh = next.packUtuh === '' ? undefined : Math.max(0, Number(next.packUtuh) || 0);
    const sisaKecil = next.sisaKecil === '' ? undefined : Math.max(0, Number(next.sisaKecil) || 0);

    if (packUtuh === undefined && sisaKecil === undefined) {
      setOpnameData((prevData) => ({ ...prevData, [itemId]: undefined }));
    } else {
      const total = Math.round(((packUtuh || 0) + (sisaKecil || 0) / faktor) * 100) / 100;
      setOpnameData((prevData) => ({ ...prevData, [itemId]: total }));
    }
  }

  function hitungSelisih(itemId) {
    const stokFisik = opnameData[itemId];
    const stokSistem = stokSistemMap[itemId];
    if (stokFisik === undefined || stokSistem === undefined) return null;
    return stokSistem - stokFisik;
  }

  function itemDenganSelisih() {
    return Object.keys(opnameData)
      .filter((itemId) => opnameData[itemId] !== undefined)
      .map((itemId) => {
        const item = items.find((i) => String(i.id) === String(itemId));
        const selisih = hitungSelisih(itemId);
        return { itemId, nama: item?.nama || `Item #${itemId}`, stokSistem: stokSistemMap[itemId], stokFisik: opnameData[itemId], selisih };
      })
      .filter((x) => x.selisih !== null && x.selisih !== 0);
  }

  function handleKlikSimpan() {
    const adaData = Object.values(opnameData).some((v) => v !== undefined);
    if (!adaData) {
      setError('Masukkan minimal 1 item stok fisik.');
      return;
    }
    setError('');
    handleSubmitOpname();
  }

  async function handleSubmitOpname() {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setRingkasanSubmit(null);

    try {
      const sesiId = lokasiTipe === 'gudang' ? crypto.randomUUID() : null;
      const promises = [];
      const itemIdsUrut = [];
      for (const itemId of Object.keys(opnameData)) {
        if (opnameData[itemId] === undefined) continue;

        const body = {
          itemId: Number(itemId),
          stokFisik: opnameData[itemId],
          periode,
          tanggal,
          ...(lokasiTipe === 'gudang' && {
            gudangId: Number(selectedGudangId),
            jenisOpname,
            sesiId,
          }),
          ...(lokasiTipe === 'outlet' && { outletId: Number(selectedOutletId), tipeOpname }),
        };

        const endpoint = lokasiTipe === 'gudang' ? '/stok-opname/gudang' : '/stok-opname/outlet';
        itemIdsUrut.push(itemId);
        promises.push(api.post(endpoint, body));
      }

      const hasilSemua = await Promise.all(promises);

      const totalDisimpan = hasilSemua.length;
      const totalDisesuaikan = hasilSemua.filter((h) => h?.disesuaikan).length;
      const detailDisesuaikan = hasilSemua
        .map((h, idx) => ({ ...h, itemId: itemIdsUrut[idx] }))
        .filter((h) => h.disesuaikan)
        .map((h) => {
          const item = items.find((i) => String(i.id) === String(h.itemId));
          return { nama: item?.nama || `Item #${h.itemId}`, stokSistem: h.stokSistem, stokFisik: h.stokFisik, selisih: h.selisih };
        });

      setRingkasanSubmit({ totalDisimpan, totalDisesuaikan, detailDisesuaikan });
      setSuccessMsg(
        lokasiTipe === 'gudang'
          ? `Opname gudang berhasil disimpan dan menunggu approval admin.`
          : `Opname outlet periode ${periode} berhasil tersimpan!`
      );
      setOpnameData({});
      setPecahanInput({});

      if (lokasiTipe === 'gudang' && selectedGudangId) {
        const stokRows = await api.get(`/laporan/stok-saat-ini?gudang_id=${selectedGudangId}`);
        const peta = {};
        (stokRows || []).forEach((r) => {
          peta[r.item_id] = Number(r.stok_saat_ini);
        });
        setStokSistemMap(peta);
      }
    } catch (err) {
      setError(err.message || 'Gagal simpan opname');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h1>Stok Opname</h1>

      {error && <div className={styles.error}>{error}</div>}
      {successMsg && <div className={styles.success}>{successMsg}</div>}

      {ringkasanSubmit && (
        <div className={styles.ringkasanSubmit}>
          <strong>{ringkasanSubmit.totalDisimpan} item tersimpan.</strong>
          {ringkasanSubmit.totalDisesuaikan > 0 ? (
            <>
              <p>{ringkasanSubmit.totalDisesuaikan} item disesuaikan ke stok sistem:</p>
              <ul>
                {ringkasanSubmit.detailDisesuaikan.map((d, idx) => (
                  <li key={idx}>
                    {d.nama}: Sistem {d.stokSistem} → Fisik {d.stokFisik} (selisih {d.selisih > 0 ? '+' : ''}{d.selisih})
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>Tidak ada penyesuaian stok sistem yang dilakukan.</p>
          )}
        </div>
      )}

      <div className={styles.formSection}>
        <div className={styles.formGroup}>
          <label>Tipe Lokasi</label>
          <div className={styles.toggleGroup}>
            <button
              className={`${styles.toggleBtn} ${lokasiTipe === 'gudang' ? styles.active : ''}`}
              onClick={() => { setLokasiTipe('gudang'); setTipeOpname('akhir'); }}
            >
              Stok Opname Gudang
            </button>
            <button
              className={`${styles.toggleBtn} ${lokasiTipe === 'outlet' ? styles.active : ''}`}
              onClick={() => setLokasiTipe('outlet')}
            >
              Stok Opname Outlet
            </button>
          </div>
        </div>

        {lokasiTipe === 'gudang' && (
          <div className={styles.formGroup}>
            <label htmlFor="gudang">Gudang</label>
            <select
              id="gudang"
              value={selectedGudangId}
              onChange={(e) => setSelectedGudangId(e.target.value)}
              className={styles.select}
            >
              <option value="">-- Pilih Gudang --</option>
              {gudangs.map((g) => (
                <option key={g.id} value={g.id}>
                  Gudang {g.nama}
                </option>
              ))}
            </select>
          </div>
        )}

        {lokasiTipe === 'outlet' && (
          <div className={styles.formGroup}>
            <label htmlFor="outlet">Outlet</label>
            <select
              id="outlet"
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className={styles.select}
            >
              <option value="">-- Pilih Outlet --</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  Outlet {o.nama}
                </option>
              ))}
            </select>
          </div>
        )}

        {lokasiTipe === 'outlet' && (
          <div className={styles.formGroup}>
            <label>Tipe Opname</label>
            <div className={styles.toggleGroup}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${tipeOpname === 'awal' ? styles.active : ''}`}
                onClick={() => setTipeOpname('awal')}
              >
                Stok Awal
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${tipeOpname === 'akhir' ? styles.active : ''}`}
                onClick={() => setTipeOpname('akhir')}
              >
                Stok Akhir
              </button>
            </div>
            <small className={styles.hint}>
              {tipeOpname === 'awal'
                ? 'Stok fisik di awal periode — dipakai sebagai titik mulai perhitungan HPP.'
                : 'Stok fisik di akhir periode — akan jadi stok awal periode berikutnya.'}
            </small>
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="periode">Periode (YYYY-MM)</label>
          <input
            id="periode"
            type="month"
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="tanggal">Tanggal Opname (YYYY-MM-DD)</label>
          <input
            id="tanggal"
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className={styles.input}
          />
        </div>

        {lokasiTipe === 'gudang' && (
          <div className={styles.formGroup}>
            <label htmlFor="jenisOpname">Jenis Opname</label>
            <select
              id="jenisOpname"
              value={jenisOpname}
              onChange={(e) => setJenisOpname(e.target.value)}
              className={styles.select}
            >
              <option value="bulanan">📅 Bulanan (Resmi, masuk laporan)</option>
              <option value="dadakan">⚡ Dadakan (Spot-check, cegah hilang)</option>
            </select>
            <small className={styles.hint}>
              {jenisOpname === 'bulanan'
                ? 'SO bulanan akan dimasukkan ke laporan forecast bulanan. Max 1x per bulan.'
                : 'SO dadakan untuk spot-check cegah barang hilang. Boleh berkali-kali dalam sebulan (asal beda tanggal) — tapi cuma 1x untuk tanggal yang sama, dan tidak masuk laporan resmi.'}
            </small>
          </div>
        )}

      </div>

      {items.length > 0 && (
        <div className={styles.tableSection}>
          <h2>Input Stok Fisik Item</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Item</th>
                <th>Satuan</th>
                {lokasiTipe === 'gudang' && <th>Stok Sistem</th>}
                <th>Stok Fisik</th>
                {lokasiTipe === 'gudang' && <th>Selisih</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const selisih = lokasiTipe === 'gudang' ? hitungSelisih(item.id) : null;
                return (
                  <tr key={item.id}>
                    <td className={styles.kode}>{item.kode_barang}</td>
                    <td>{item.nama}</td>
                    <td className={styles.satuan}>{item.satuan}</td>
                    {lokasiTipe === 'gudang' && (
                      <td className={styles.satuan}>{stokSistemMap[item.id] ?? '-'}</td>
                    )}
                    <td>
                      {(() => {
                        const faktorInfo = parseFaktorSatuan(item.satuan);
                        if (!faktorInfo) {
                          return (
                            <input
                              type="number"
                              min="0"
                              value={opnameData[item.id] ?? ''}
                              onChange={(e) => handleStokFisikChange(item.id, e.target.value)}
                              placeholder="0"
                              className={styles.inputCell}
                            />
                          );
                        }
                        const sub = pecahanInput[item.id] || { packUtuh: '', sisaKecil: '' };
                        return (
                          <div className={styles.pecahanGroup}>
                            <input
                              type="number"
                              min="0"
                              value={sub.packUtuh}
                              onChange={(e) => handlePecahanChange(item.id, 'packUtuh', e.target.value)}
                              placeholder="pack"
                              className={styles.inputPecahan}
                            />
                            <span className={styles.pecahanPlus}>+</span>
                            <input
                              type="number"
                              min="0"
                              value={sub.sisaKecil}
                              onChange={(e) => handlePecahanChange(item.id, 'sisaKecil', e.target.value)}
                              placeholder={faktorInfo.labelKecil}
                              className={styles.inputPecahan}
                            />
                            <small className={styles.pecahanHasil}>
                              = {opnameData[item.id] ?? 0} {item.satuan}
                            </small>
                          </div>
                        );
                      })()}
                    </td>
                    {lokasiTipe === 'gudang' && (
                      <td className={selisih ? (selisih !== 0 ? styles.selisihBeda : styles.selisihSama) : ''}>
                        {selisih === null ? '-' : (selisih > 0 ? `+${selisih}` : selisih)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.buttonGroup}>
        <button
          className={styles.btn}
          onClick={handleKlikSimpan}
          disabled={loading || items.length === 0 || !Object.values(opnameData).some((v) => v !== undefined)}
        >
          {loading ? 'Sedang simpan...' : 'Simpan Opname'}
        </button>
      </div>

    </div>
  );
}
