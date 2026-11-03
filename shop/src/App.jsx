import { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { theme } from './theme';
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
  return null;
};

export const App = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <StoreProvider>
      <HashRouter>
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
      </HashRouter>
    </StoreProvider>
  </ThemeProvider>
);
