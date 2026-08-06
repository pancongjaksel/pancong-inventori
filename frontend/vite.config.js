import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA di-set minimal dulu (nama, ikon, offline-fallback dasar). Mode offline
// beneran (queue submit pas sinyal lemah) itu Fase 3 di PRD, belum di sini —
// lihat ROADMAP Tahap 3.4.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
    port: 5174, // sengaja bukan 5173 default — port itu udah dipakai project lain (pancong-jaksel-ims) yang lagi aktif jalan di Mac Mini ini
    host: true, // izinkan diakses dari perangkat lain di WiFi yang sama (HP), bukan cuma dari komputer ini
  },
});
