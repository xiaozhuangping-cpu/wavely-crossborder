import { createTheme } from '@mui/material/styles';

// Wavely 品牌：沙白底、深海青为唯一强调色；编号类文字用等宽字（--mono）
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0e7490', dark: '#155e75', light: '#22d3ee', contrastText: '#fff' },
    secondary: { main: '#0e7490' },
    background: { default: '#fbfaf7', paper: '#ffffff' },
    text: { primary: '#10201f', secondary: '#5b6b6a' },
    divider: '#e7e2d8',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Inter, "PingFang SC", "Hiragino Sans", "Microsoft YaHei", system-ui, sans-serif',
    h1: { fontFamily: 'var(--display)', fontWeight: 500 },
    h2: { fontFamily: 'var(--display)', fontWeight: 500 },
    h3: { fontFamily: 'var(--display)', fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 10, paddingInline: 16, transition: 'background-color 150ms cubic-bezier(.22,1,.36,1), border-color 150ms cubic-bezier(.22,1,.36,1)', '&:active': { transform: 'scale(.98)' } } } },
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: '1px solid rgba(16,32,31,.09)', borderRadius: 16, transition: 'border-color 150ms cubic-bezier(.22,1,.36,1)', '&:hover': { borderColor: 'rgba(16,32,31,.2)' } } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12, background: '#fff' } } },
  },
});
