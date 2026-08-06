# PRD: Aplikasi Inventori Terintegrasi — Pancong Jaksel

**Versi:** 4.0 (Final — termasuk alur Barang Masuk langsung dari supplier ke Gudang UGM/Glagahsari)
**Tanggal:** 4 Agustus 2026
**Pemilik Produk:** Rinto
**File terkait:**
- `Rekap_SKU_Pancong_Jaksel.xlsx` — 41 SKU master, status aktif/tidak bergerak (dari jurnal pembelian Mei–Jul 2026)
- `wireframe-inventori-pancong-jaksel.html` — wireframe interaktif (buka di browser)
- `PRD_Aplikasi_Inventori_Pancong_Jaksel_v2.md` — draf sebelumnya (rujukan histori diskusi)

---

## 1. Latar Belakang

Pancong Jaksel mengoperasikan **3 gudang** (Produksi/Kotagede, Glagahsari, UGM) dan **6 outlet penjualan** (Glagahsari, Pogung, Kaliurang, UGM, UMY, UAD — sebagian outlet sama lokasinya dengan gudang, sebagian tidak punya gudang sendiri dan ambil stok dari gudang terdekat). Saat ini pencatatan stok manual/terpisah, sulit memantau stok awal, barang masuk, barang keluar ke crew, pemakaian produksi, dan sisa stok real-time.

## 2. Tujuan Produk

1. Mencatat stok dari titik masuk sampai keluar (full traceability), termasuk perbedaan antara **Gudang** (tempat simpan fisik) dan **Outlet** (titik jual/pakai).
2. Visibilitas sisa stok real-time per lokasi.
3. Akses berbeda per gudang, dengan **1 admin yang mengelola ketiga gudang** (bukan 3 admin terpisah) via *switch gudang* dalam satu akun.
4. Menghubungkan pemakaian bahan produksi ke HPP.
5. Stok opname akhir bulan di gudang **dan** outlet (kumulatif antar-periode), untuk mendeteksi barang hilang antara pengambilan dan pemakaian, lalu diekspor jadi dasar forecast pembelian bulan berikutnya.

## 3. Struktur Lokasi & Jalur Distribusi (final)

| Konsep | Lokasi | Catatan |
|---|---|---|
| **Gudang Produksi** (Kotagede) | Hub pusat | **Akses admin saja** — bukan titik ambil crew. Sumber restock ke Gudang UGM & Gudang Glagahsari, dan tempat pemakaian bahan produksi (Fase 2). |
| **Gudang UGM** | Serving warehouse | Melayani ambilan crew untuk outlet: **UGM, Pogung, Kaliurang** |
| **Gudang Glagahsari** | Serving warehouse | Melayani ambilan crew untuk outlet: **Glagahsari, UMY, UAD** |

Jalur distribusi:
```
Gudang Produksi (Kotagede) — admin only
        ├──→ Gudang UGM ──→ Outlet: UGM, Pogung, Kaliurang
        └──→ Gudang Glagahsari ──→ Outlet: Glagahsari, UMY, UAD
```

**Jalur Barang Masuk (2 sumber, lihat 5.1 & 5.1b):**
```
Supplier ──→ Gudang Produksi          (Barang Masuk, input Admin)
Supplier ──→ Gudang UGM               (Barang Masuk, input Crew jaga → verifikasi Admin)
Supplier ──→ Gudang Glagahsari        (Barang Masuk, input Crew jaga → verifikasi Admin)
Gudang Produksi ──→ Gudang UGM/Glagahsari   (Transfer, bukan Barang Masuk — beda alur, lihat 5.4)
```
Tidak semua stok masuk lewat Gudang Produksi — supplier bisa kirim langsung ke Gudang UGM atau Glagahsari kapan pun, dan itu **bukan Transfer** (karena sumbernya bukan gudang lain, tapi supplier langsung).

**6 outlet final:** Glagahsari, Pogung, Kaliurang (bukan "Jakal" — nama jalan yang sama, disatukan), UGM, UMY, UAD.

Implikasi desain: form "Ambil Barang" untuk crew di device Gudang UGM hanya menampilkan pilihan Outlet Tujuan = {UGM, Pogung, Kaliurang}; device Gudang Glagahsari hanya menampilkan {Glagahsari, UMY, UAD}. Gudang Produksi tidak punya form pengambilan crew sama sekali — hanya form Transfer (ke UGM/Glagahsari) dan (Fase 2) form Pemakaian Produksi, keduanya khusus admin.

## 4. Peran & Akses

| Role | Deskripsi | Akses |
|---|---|---|
| **Owner (Rinto)** | Pemilik bisnis | Semua gudang, semua laporan, approval |
| **Admin** (1 orang untuk 3 gudang) | Kelola stok, transfer, opname | Bisa *switch* antar Gudang Produksi/Glagahsari/UGM dalam 1 akun; satu-satunya role yang bisa akses Gudang Produksi, transfer antar gudang, & koreksi/batalkan transaksi |
| **Crew Shift** | Ambil barang untuk operasional + terima kiriman supplier saat jaga | Form "Ambil Barang" di **Gudang UGM atau Gudang Glagahsari** (sesuai device), dengan pilihan Outlet Tujuan terbatas sesuai jalur distribusi di atas. **Juga** bisa input form "Barang Masuk" terbatas (lihat 5.1b) saat supplier kirim langsung ke gudang tempat crew jaga — tapi transaksinya **berstatus "Menunggu Verifikasi"** sampai Admin cek, stok belum bertambah otomatis. Tidak login per-akun — device dipakai bergantian antar crew, nama diisi manual tiap submit; tidak bisa lihat stok gudang lain atau data keuangan |

## 5. Alur Proses Utama

```
[Stok Awal] → [Barang Masuk] → [STOK TERSEDIA] → [Diambil Crew → Outlet Tujuan]
                                     ├─→ [Dipakai Produksi]
                                     ├─→ [Transfer antar Gudang]
                                     └─→ [Stok Opname akhir bulan]
```

### 5.1 Barang Masuk
Item, jumlah, satuan, harga beli (opsional HPP), supplier/asal, gudang tujuan, PIC input, **foto bukti (wajib)**.

### 5.1b Barang Masuk Langsung dari Supplier ke Gudang UGM/Glagahsari (input Crew, verifikasi Admin)
- Berlaku hanya di **Gudang UGM dan Gudang Glagahsari** (bukan Gudang Produksi — di sana Admin yang input langsung, lihat 5.1).
- Saat supplier kirim barang langsung ke gudang tempat crew sedang jaga, crew yang menerima **bisa langsung input** via form Barang Masuk versi ringkas: item, jumlah, satuan, foto bukti nota (wajib), nama crew penerima.
- Transaksi ini **tidak langsung menambah stok sistem** — statusnya **"Menunggu Verifikasi"**.
- Admin membuka daftar "Barang Masuk — Perlu Verifikasi" (across semua gudang), cek kecocokan foto/nota, lalu:
  - **Verifikasi/Setujui** → stok gudang bertambah, status jadi "Terverifikasi".
  - **Revisi** → Admin bisa koreksi jumlah/item sebelum menyetujui (mis. crew salah input qty), dengan catatan alasan (konsisten dengan prinsip audit trail di 5.3).
  - **Tolak** → transaksi ditandai "Ditolak", tidak menambah stok, alasan wajib diisi (mis. barang gak sesuai PO, dobel input).
- Barang Masuk yang diinput langsung oleh Admin (baik di Gudang Produksi maupun saat Admin sendiri yang terima di UGM/Glagahsari) **langsung berstatus "Terverifikasi"** — tidak perlu approval tambahan.
- **Visibilitas hasil verifikasi:** transaksi yang direvisi/ditolak tetap tampil di riwayat gudang dengan **label status jelas** (mis. badge "Ditolak Admin" / "Direvisi Admin" + alasan), sehingga crew siapa pun yang buka riwayat otomatis tahu tanpa perlu notifikasi personal (device dipakai bergantian, tidak ada akun per-crew). Untuk kasus yang butuh tindak lanjut cepat (mis. barang harus dikembalikan ke supplier hari itu juga), Admin tetap komunikasikan manual via WA grup — sistem tidak menggantikan urgensi itu.

### 5.2 Diambil Crew (multi-item per sesi)
- Crew memilih **beberapa item sekaligus** dalam satu sesi (bukan submit satu-satu) — pilih item → muncul stepper qty inline → tambah item lain → review semua sebelum kirim.
- Sebelum kirim, **wajib isi**:
  - **Nama Crew** (teks manual — device dipakai bergantian, tidak ada login per orang)
  - **Outlet Tujuan** (dropdown, otomatis terbatas sesuai gudang device: UGM device → {UGM, Pogung, Kaliurang}; Glagahsari device → {Glagahsari, UMY, UAD})
- Tombol kirim nonaktif sampai kedua field terisi.
- Semua item dalam satu sesi tersimpan sebagai **satu transaksi/sesi pengambilan** (field `sesi_id` menaungi banyak baris item), bukan transaksi terpisah per item.

### 5.3 Koreksi / Pembatalan Transaksi (khusus Admin)
- Prinsip: **tidak ada hapus permanen** — hanya koreksi dengan jejak audit.
- Admin buka detail transaksi → "Koreksi/Batalkan" → isi alasan → sistem membuat **entri pembalik (reversal)** yang mengembalikan stok. Transaksi asli tetap terlihat, berlabel "Dikoreksi".
- Crew tidak punya akses untuk menghapus/mengoreksi transaksinya sendiri.

### 5.4 Transfer Antar Gudang
- Rute utama: Gudang Produksi → Gudang UGM / Gudang Glagahsari (restock rutin, admin only).
- Transfer antar UGM ↔ Glagahsari juga dimungkinkan kalau darurat (misal salah kirim / kebutuhan mendadak).
- Alur 2 langkah: **Dikirim → Diterima** (bukan sekali klik), supaya kalau ada selisih di jalan, ketahuan di titik mana.
- **Foto bukti wajib** saat kirim maupun terima.

### 5.5 Pemakaian Produksi (Fase 2 — BOM/resep campuran)
- Resep/BOM per produk sebagai **baseline standar** (mis. 1 batch adonan pancong = X kg tepung, Y butir telur).
- Saat produksi dicatat, sistem **menyarankan** pengurangan bahan baku sesuai BOM, tapi admin/PIC produksi bisa **override qty aktual terpakai** per sesi (dengan catatan alasan opsional) — mengakomodasi item yang resepnya masih fleksibel/berubah-ubah.
- Selisih antara BOM baseline vs aktual terpakai tersimpan untuk analisis (mis. mendeteksi resep yang perlu distandarkan atau bahan yang boros).

### 5.6 Stok Opname Akhir Bulan — dua jenis lokasi, kumulatif antar-periode

**A. Opname Gudang** (3 lokasi: Produksi, Glagahsari, UGM)
- Bandingkan **Stok Sistem** vs **Stok Fisik** per item → selisih otomatis terhitung.

**B. Opname Outlet** (Pogung, Kaliurang, UMY, UAD, + Glagahsari & UGM dobel fungsi)
- **Kumulatif (carry-over):** `Ekspektasi = Stok Awal Periode (= Stok Fisik hasil opname bulan lalu) + Total Diterima dari Gudang (periode berjalan) − Stok Fisik Sekarang = Selisih`.
- Opname bulan pertama pakai stok awal manual (opname baseline / hasil hitung fisik awal go-live).
- Tujuan: mendeteksi barang hilang antara saat diambil crew dari gudang dan saat sampai/terpakai di outlet, tanpa "mereset" ke nol tiap bulan sehingga sisa stok riil tetap terlacak.

**Output:** Rekap gabungan semua gudang + outlet → **export ke Excel dengan template forecast otomatis**, menghitung kebutuhan pembelian bulan berikutnya berdasarkan **rata-rata pemakaian 3 bulan terakhir** per item (bukan cuma data mentah).

## 6. Ruang Lingkup

### Fase 1 — MVP
- Master data item (41 SKU awal, lihat `Rekap_SKU_Pancong_Jaksel.xlsx`; catatan: BA-004 Baking Powder perlu perbaikan nama/satuan saat migrasi — 2 baris jurnal Juli 2026 tercatat kosong)
- Stok awal, barang masuk (dengan foto wajib; input Admin langsung terverifikasi, input Crew di Gudang UGM/Glagahsari perlu verifikasi Admin dulu — lihat 5.1b), diambil crew (multi-item + nama + outlet tujuan terbatas sesuai gudang)
- Antrean "Barang Masuk — Perlu Verifikasi" di dashboard Admin
- Transfer antar gudang (dikirim → diterima, foto wajib)
- Dashboard sisa stok per gudang, dengan alert stok menipis
- Koreksi/pembatalan transaksi dengan audit trail (khusus Admin)
- Stok opname gudang + outlet (kumulatif), dengan export rekap Excel + template forecast rata-rata 3 bulan
- Role-based access: Owner / Admin (switch 3 gudang, termasuk Produksi) / Crew (device bersama, Gudang UGM atau Glagahsari saja)

### Fase 2 — Produksi & BOM
- Modul resep/BOM (baseline standar + override aktual per sesi), pemakaian produksi, HPP per batch

### Fase 3 — Nice-to-have
- Notifikasi stok menipis otomatis (reorder point)
- Export otomatis ke WhatsApp/Excel setelah tutup shift
- Scan barcode/QR
- Mode offline dengan sinkron otomatis (penting untuk lokasi bersinyal lemah)

## 7. Model Data (Entitas Utama)

| Entitas | Field Kunci |
|---|---|
| **Item** | id, nama, kategori, satuan, gudang default |
| **Gudang** | id, nama (Produksi/Glagahsari/UGM), tipe (hub_admin_only / serving) |
| **Outlet** | id, nama (Glagahsari/Pogung/Kaliurang/UGM/UMY/UAD), gudang_asal_id (UGM atau Glagahsari) |
| **User** | id, nama, role, gudang_akses |
| **Transaksi Masuk** | id, item_id, gudang_id, jumlah, tanggal, harga, sumber, foto_bukti (wajib), diinput_oleh_user_id, diinput_oleh_role (admin/crew), status_verifikasi (terverifikasi/menunggu/direvisi/ditolak), label_status (badge tampilan riwayat), diverifikasi_oleh_user_id, catatan_verifikasi |
| **Sesi Pengambilan Crew** | id, nama_crew (teks), outlet_tujuan_id, gudang_asal_id, tanggal, daftar_item[{item_id, qty}] |
| **Transaksi Produksi** (Fase 2) | id, resep_id, jumlah_batch, tanggal, bahan_terpakai[{item_id, qty_bom, qty_aktual, catatan}] |
| **Transfer Gudang** | id, item_id, gudang_asal_id, gudang_tujuan_id, jumlah, status (dikirim/diterima), foto_bukti (wajib), tanggal |
| **Koreksi Transaksi** | id, transaksi_asal_id, alasan, oleh_user_id, tanggal, entri_pembalik_id |
| **Stok Opname** | id, lokasi_id, tipe_lokasi (gudang/outlet), item_id, stok_awal_periode, stok_sistem_atau_diterima, stok_fisik, selisih, tanggal, periode |
| **Resep/BOM** (Fase 2) | id, nama_produk, daftar_bahan[{item_id, qty_baseline}] |

## 8. Kebutuhan Non-Fungsional

- Multi-akses berbasis lokasi: Admin switch antar 3 gudang (termasuk Produksi) dalam 1 akun; Crew hanya akses Gudang UGM atau Glagahsari sesuai device.
- Audit trail: semua transaksi tercatat siapa & kapan; **tidak bisa dihapus**, hanya dikoreksi dengan jejak (lihat 5.3).
- Form crew harus cepat diisi (target <30 detik), mengingat shift panjang dan device dipakai bergantian.
- Bisa diakses dari browser HP (web-based, prioritas dari Rinto).
- Konsisten dengan sistem pelaporan keuangan yang sudah ada (HPP, komisi delivery app) supaya tidak dobel kerja.

## 9. Metrik Keberhasilan

- Selisih stok opname vs sistem < 5% per bulan, di gudang maupun outlet.
- Waktu pembuatan laporan stok bulanan berkurang signifikan (manual → otomatis).
- 100% sesi pengambilan crew tercatat dengan nama & outlet tujuan lengkap.
- Rekap SO bulanan bisa diekspor dan langsung dipakai untuk forecast pembelian, tanpa olah data manual tambahan.

## 10. Keputusan Final (sebelumnya Pertanyaan Terbuka di v2)

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Jumlah outlet & gudang asal default | 6 outlet (Jakal = Kaliurang, disatukan). UGM/Pogung/Kaliurang ← Gudang UGM. Glagahsari/UMY/UAD ← Gudang Glagahsari. Gudang Produksi khusus admin. |
| 2 | Perhitungan opname outlet | Kumulatif (carry-over stok awal dari opname bulan sebelumnya) |
| 3 | Sifat resep/BOM | Campuran — baseline standar + override aktual per sesi |
| 4 | Foto bukti barang masuk & transfer | Wajib untuk keduanya |
| 5 | Format export forecast | Template otomatis dengan rata-rata pemakaian 3 bulan terakhir |
| 6 | Barang masuk langsung dari supplier ke Gudang UGM/Glagahsari — siapa yang input? | Crew yang jaga di lokasi bisa input langsung (5.1b), tapi status "Menunggu Verifikasi" sampai Admin cek & setujui. Stok baru bertambah setelah diverifikasi. |

## 11. Di Luar Ruang Lingkup

- Integrasi otomatis ke marketplace/reseller (bisnis terpisah).
- Payroll/absensi crew.

---

*PRD ini final untuk kebutuhan Fase 1 & 2. Langkah berikutnya: desain skema database teknis (PostgreSQL) mengikuti Model Data di Bagian 7, lalu implementasi mengikuti stack yang sudah berjalan (Node.js + React PWA, Docker di Mac Mini).*
