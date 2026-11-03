import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/wavely-crossborder/shop/',
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
