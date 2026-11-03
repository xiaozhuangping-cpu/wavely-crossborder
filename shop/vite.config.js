import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/wavely-crossborder/shop/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // 框架库单独打包：业务代码更新时浏览器可继续使用缓存
        manualChunks(id) {
          const m = id.match(/node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/);
          if (!m) return;
          const pkg = m[1].replace('\\', '/');
          if (pkg === 'react-admin' || pkg.startsWith('ra-') || pkg === '@raphiniert/ra-data-postgrest') return 'vendor-admin';
          if (pkg.startsWith('@mui/') || pkg.startsWith('@emotion/')) return 'vendor-mui';
          if (pkg.startsWith('@supabase/')) return 'vendor-supabase';
          if (['react', 'react-dom', 'scheduler', 'react-router', 'react-router-dom'].includes(pkg)) return 'vendor-react';
        },
      },
    },
  },
});
