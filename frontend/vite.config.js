import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA di-set minimal dulu (nama, ikon, offline-fallback dasar). Mode offline
// beneran (queue submit pas sinyal lemah) itu Fase 3 di PRD, belum di sini —
// lihat ROADMAP Tahap 3.4.
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Pisahkan library besar yang dipakai lintas halaman dari kode aplikasi.
        // Halaman yang berubah tidak lagi memaksa browser mengunduh ulang React
        // atau pemindai QR, terutama membantu perangkat crew di koneksi seluler.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'qr-vendor': ['html5-qrcode'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // /uploads/* dilayani langsung sama backend (foto bukti nota), BUKAN
      // bagian dari SPA — tanpa ini, klik link foto bukti/preview upload
      // ke-intercept sama NavigationRoute default (semua request navigasi
      // di-fallback ke index.html), jadi selalu blank kayak buka halaman app
      // yang salah, meski server-side (nginx/express.static) udah bener.
      workbox: {
        navigateFallbackDenylist: [/^\/uploads\//],
      },
      manifest: {
        name: 'Inventori Pancong Jaksel',
        short_name: 'Inventori PJ',
        description: 'Aplikasi inventori internal Pancong Jaksel',
        theme_color: '#2B2320',
        background_color: '#FAF6EE',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5174, // 5173 bentrok sama project IMS lain yang aktif di Mac Mini
    host: true, // izinkan diakses dari perangkat lain di WiFi yang sama (HP), bukan cuma dari komputer ini
  },
});
