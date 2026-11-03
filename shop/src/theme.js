import { createTheme } from '@mui/material/styles';

// Wavely 品牌：沙白底、深海青主色、珊瑚点缀
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0e7490', dark: '#155e75', light: '#22d3ee', contrastText: '#fff' },
    secondary: { main: '#f97362' },
    background: { default: '#fbfaf7', paper: '#ffffff' },
    text: { primary: '#10201f', secondary: '#5b6b6a' },
    divider: '#e7e2d8',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Inter, "PingFang SC", "Hiragino Sans", "Microsoft YaHei", system-ui, sans-serif',
    h1: { fontFamily: 'var(--display)', fontWeight: 600 },
    h2: { fontFamily: 'var(--display)', fontWeight: 600 },
    h3: { fontFamily: 'var(--display)', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 999, paddingInline: 18 } } },
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: '1px solid #ece7dd', borderRadius: 18, transition: 'transform .25s, box-shadow .25s', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 18px 40px rgba(16,32,31,.08)' } } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 999 } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12, background: '#fff' } } },
  },
});
