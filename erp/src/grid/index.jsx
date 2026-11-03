import { lazy, Suspense } from 'react';
import { LinearProgress } from '@mui/material';

// AG Grid 体积较大，按需加载
const AgListImpl = lazy(() => import('./AgList'));

export const AgList = (props) => (
  <Suspense fallback={<LinearProgress sx={{ my: 2 }} />}>
    <AgListImpl {...props} />
  </Suspense>
);

// 列定义辅助：React 单元格渲染器
export const col = (field, headerName, extra = {}) => ({ field, headerName, ...extra });
export const render = (headerName, Comp, extra = {}) => ({ headerName, cellRenderer: (p) => (p.data ? <Comp r={p.data} /> : null), sortable: false, ...extra });
