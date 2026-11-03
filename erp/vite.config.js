import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/wavely-crossborder/erp/',
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
          // react-admin 与 MUI 互相引用，拆成两个包会产生循环依赖（初始化顺序错误），合在一起
          if (pkg === 'react-admin' || pkg.startsWith('ra-') || pkg === '@raphiniert/ra-data-postgrest'
              || pkg.startsWith('@mui/') || pkg.startsWith('@emotion/')) return 'vendor-ui';
          if (pkg.startsWith('@supabase/')) return 'vendor-supabase';
          if (['react', 'react-dom', 'scheduler', 'react-router', 'react-router-dom'].includes(pkg)) return 'vendor-react';
        },
      },
    },
  },
});
