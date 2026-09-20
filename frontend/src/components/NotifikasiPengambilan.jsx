import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import ModalKoreksiCepat from './ModalKoreksiCepat';

const INTERVAL_POLLING = 5000;

export default function NotifikasiPengambilan() {
  const [sesiList, setSesiList] = useState([]);
  const [jumlahOpnamePending, setJumlahOpnamePending] = useState(0);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [panelTerbuka, setPanelTerbuka] = useState(false);
  const [panelPos, setPanelPos] = useState(null);
  const [itemDikoreksi, setItemDikoreksi] = useState(null);
  const lastReadIdsRef = useRef(new Set());
  const openRef = useRef(false); // sumber kebenaran sync — hindari stale closure
  const bellRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    let batal = false;
    async function poll() {
      try {
        const [dataSesi, dataPending] = await Promise.all([
          api.get('/laporan/sesi-pengambilan-terbaru'),
          api.get('/opname-outlet/pending/jumlah'),
        ]);
        if (batal) return;
        if (Array.isArray(dataSesi)) setSesiList(dataSesi);
        setJumlahOpnamePending(dataPending?.jumlah ?? 0);
      } catch {
        // diam-diam gagal — coba lagi di interval berikutnya
      }
    }
    poll();
    const timer = setInterval(poll, INTERVAL_POLLING);
    return () => { batal = true; clearInterval(timer); };
  }, []);

  // Tutup panel kalau klik di luar
  useEffect(() => {
    if (!panelTerbuka) return;
    function handleClickLuar(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        openRef.current = false;
        setPanelTerbuka(false);
        setPanelPos(null);
      }
    }
    document.addEventListener('mousedown', handleClickLuar);
    return () => document.removeEventListener('mousedown', handleClickLuar);
  }, [panelTerbuka]);

  const sesiTampil = sesiList.filter((s) => !dismissedIds.has(s.sesi_id));
  const jumlahBelumDibaca = sesiTampil.filter((s) => !lastReadIdsRef.current.has(s.sesi_id)).length + jumlahOpnamePending;

  function togglePanel() {
    sesiTampil.forEach((s) => lastReadIdsRef.current.add(s.sesi_id));
    // Baca dari ref — bukan dari closure panelTerbuka yang bisa stale
    if (openRef.current) {
      openRef.current = false;
      setPanelTerbuka(false);
      setPanelPos(null);
      return;
    }
    openRef.current = true;
    // Tunda kalkulasi ke setelah layout frame — sidebar perlu settle dulu
    requestAnimationFrame(() => {
      if (!bellRef.current) { openRef.current = false; return; }
      const rect = bellRef.current.getBoundingClientRect();
      const PANEL_W = 320;
      const MARGIN = 8;
      const sidebarEl = document.querySelector('.admin-sidebar');
      const sidebarRect = sidebarEl?.getBoundingClientRect();
      const sidebarMin = (sidebarRect && sidebarRect.right > 0) ? sidebarRect.right + 4 : 0;
      let left = Math.max(rect.right, sidebarMin);
      if (left + PANEL_W > window.innerWidth - MARGIN) {
        left = window.innerWidth - PANEL_W - MARGIN;
      }
      left = Math.max(left, MARGIN);
      setPanelPos({ top: rect.bottom + 8, left });
      setPanelTerbuka(true);
    });
  }

  function tutupKartu(sesiId) {
    setDismissedIds((prev) => { const n = new Set(prev); n.add(sesiId); return n; });
  }

  function hapusSemua() {
    setDismissedIds((prev) => {
      const n = new Set(prev);
      sesiTampil.forEach((s) => n.add(s.sesi_id));
      return n;
    });
  }

  return (
    <>
      <button ref={bellRef} className="notif-bell" onClick={togglePanel} aria-label="Notifikasi pengambilan">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {jumlahBelumDibaca > 0 && (
          <span className="notif-bell__badge">
            {jumlahBelumDibaca > 99 ? '99+' : jumlahBelumDibaca}
          </span>
        )}
      </button>

      {panelTerbuka && panelPos && createPortal(
        <div
          ref={panelRef}
          data-notif-panel
          className="notif-panel"
          style={{ position: 'fixed', top: panelPos.top, left: panelPos.left }}
        >
          <div className="notif-panel__header">
            <span>Pengambilan Crew</span>
            {sesiTampil.length > 0 && (
              <button onClick={hapusSemua} className="notif-panel__hapus-semua">
                Hapus semua
              </button>
            )}
          </div>
          {jumlahOpnamePending > 0 && (
            <div className="notif-panel__kartu" style={{ background: 'var(--warna-krim-redup)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warna-arang)' }}>
                Opname Outlet
              </div>
              <div style={{ fontSize: 12, color: 'var(--warna-abu)', marginTop: 4 }}>
                {jumlahOpnamePending} opname menunggu approval
              </div>
            </div>
          )}
          {sesiTampil.length === 0 && jumlahOpnamePending === 0 ? (
            <p className="notif-panel__kosong">Tidak ada notifikasi.</p>
          ) : sesiTampil.length > 0 ? (
            <div className="notif-panel__list">
              {sesiTampil.map((sesi) => (
                <KartuSesi
                  key={sesi.sesi_id}
                  sesi={sesi}
                  onDismiss={() => tutupKartu(sesi.sesi_id)}
                  onKoreksi={(item) =>
                    setItemDikoreksi({
                      sesiPengambilanItemId: item.sesi_pengambilan_item_id,
                      itemNama: item.item_nama,
                      qtySekarang: item.qty,
                      satuan: item.satuan,
                    })
                  }
                />
              ))}
            </div>
          ) : null}
        </div>,
        document.body
      )}

      {itemDikoreksi && (
        <ModalKoreksiCepat
          sesiPengambilanItemId={itemDikoreksi.sesiPengambilanItemId}
          itemNama={itemDikoreksi.itemNama}
          qtySekarang={itemDikoreksi.qtySekarang}
          satuan={itemDikoreksi.satuan}
          onClose={() => setItemDikoreksi(null)}
        />
      )}
    </>
  );
}

function KartuSesi({ sesi, onDismiss, onKoreksi }) {
  const items = Array.isArray(sesi.items) && sesi.items[0] !== null ? sesi.items : [];
  const dibatalkan = sesi.label_status === 'Dikoreksi';

  const tanggal = sesi.created_at
    ? new Date(sesi.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    : '';
  const waktu = sesi.created_at
    ? new Date(sesi.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="notif-panel__kartu" style={{ opacity: dibatalkan ? 0.7 : 1 }}>
      <div className="notif-panel__kartu-header">
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--warna-arang)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {sesi.nama_crew || 'Crew'}
            {dibatalkan && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                background: '#FBEAE9',
                color: 'var(--warna-bahaya)',
                padding: '1px 5px',
                borderRadius: 4,
              }}>
                Dibatalkan
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--warna-abu)' }}>
            {sesi.gudang_nama} &middot; {tanggal} &middot; {waktu}
          </div>
        </div>
        <button onClick={onDismiss} className="notif-panel__kartu-tutup" aria-label="Tutup">
          &times;
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
        {items.map((item) => (
          <div
            key={item.item_id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}
          >
            <span style={{ color: 'var(--warna-arang)' }}>{item.item_nama} &mdash; {Number(item.qty).toLocaleString('id-ID')} {item.satuan}</span>
            {!dibatalkan && (
              <button onClick={() => onKoreksi(item)} className="notif-panel__koreksi-btn">
                &#9998; Koreksi
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
