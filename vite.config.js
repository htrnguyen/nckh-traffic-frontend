import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg'],
      manifest: {
        name: 'TrafficFlow AI - Điều hướng thông minh',
        short_name: 'TrafficFlow',
        description: 'Dự đoán giao thông bằng AI theo thời gian thực (NCKH)',
        theme_color: '#0058bd',
        background_color: '#f6faff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/hcmc-camera': {
        target: 'https://giaothong.hochiminhcity.gov.vn',
        changeOrigin: true,
        secure: false, // Bỏ qua lỗi SSL chứng chỉ của HCMC
        rewrite: (path) => path.replace(/^\/hcmc-camera/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Giả mạo headers trình duyệt để qua mặt Firewall HCMC
            proxyReq.setHeader('Referer', 'https://giaothong.hochiminhcity.gov.vn/');
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
          });
          // Chặn Vite ném lỗi đỏ lè ra Terminal khi server HCMC cúp điện (socket hang up)
          proxy.on('error', (err, req, res) => {
            if (!res.headersSent) {
              res.writeHead(504, { 'Content-Type': 'text/plain' });
            }
            res.end('Camera Server Timeout');
          });
        }
      }
    }
  }
})
