import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  // IMPORTANT: Replace 'senkai-sengi-pwa' with your actual GitHub repository name.
  base: '/senkai-sengi-pwa/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/icons/*.png', 'assets/cards/*.png'],
      manifest: {
        name: 'Senkai Sengi Digital',
        short_name: 'SenkaiSengi',
        description: "A digital implementation of the trading card game 'Senkai Sengi'.",
        theme_color: '#1e293b',
        background_color: '#1e293b',
        display: 'standalone',
        start_url: '.',
        icons: [
          {
            src: 'assets/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'assets/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
});
