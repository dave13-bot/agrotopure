import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, proxy: { '/api': 'http://localhost:7071' } },
  build: {
    sourcemap: false,
    target: 'es2020',
    rollupOptions: { output: { manualChunks: { icons: ['lucide-react'], mapping: ['leaflet'], charts: ['recharts'] } } },
    chunkSizeWarningLimit: 600
  }
});
