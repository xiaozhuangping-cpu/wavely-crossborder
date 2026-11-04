import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { theme } from './theme';
import { applySeo, SITE } from './seo';
import { StoreProvider } from './store';
import { Header, CartDrawer, Footer } from './components/Layout';
import { ChatWidget } from './components/ChatLauncher';
import { Home } from './pages/Home';
import { Product } from './pages/Product';
import { Checkout, Done } from './pages/Checkout';
import { Track } from './pages/Track';

const ScrollTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  // 商品页自己设置 SEO；其他页面恢复默认标题 / 描述，canonical 指向当前路径
  useEffect(() => { if (!pathname.startsWith('/p/')) applySeo({ url: SITE + pathname.replace(/^\//, '') }); }, [pathname]);
  return null;
};

export const App = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <StoreProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <ScrollTop />
        <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
          <Header />
          <Box component="main" sx={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/p/:id" element={<Product />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/done/:no" element={<Done />} />
              <Route path="/track" element={<Track />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Box>
          <Footer />
        </Box>
        <CartDrawer />
        <ChatWidget />
      </BrowserRouter>
    </StoreProvider>
  </ThemeProvider>
);
