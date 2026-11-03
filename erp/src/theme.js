import { defaultTheme, defaultDarkTheme } from 'react-admin';

// Gmail 式配色（Material 3 风格），品牌仍为 Wavely
const tokens = {
  light: {
    bg: '#f6f8fc', surface: '#ffffff', search: '#eaf1fb', searchFocus: '#ffffff',
    compose: '#c2e7ff', composeText: '#001d35', composeHover: '#b3dcf7',
    navActive: '#d3e3fd', navActiveText: '#041e49', navHover: 'rgba(68,71,70,.08)',
    text: '#1f1f1f', textSub: '#444746', border: '#e3e3e3',
    readRow: '#f2f6fc', unreadRow: '#ffffff', selectedRow: '#c2dbff',
    rowShadow: 'inset 1px 0 0 #dadce0, inset -1px 0 0 #dadce0, 0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)',
    primary: '#0b57d0',
  },
  dark: {
    bg: '#111111', surface: '#1f1f1f', search: '#2a2a2a', searchFocus: '#353535',
    compose: '#004a77', composeText: '#c2e7ff', composeHover: '#0b5a8d',
    navActive: '#004a77', navActiveText: '#c2e7ff', navHover: 'rgba(227,227,227,.08)',
    text: '#e3e3e3', textSub: '#c4c7c5', border: '#3c4043',
    readRow: '#1f1f1f', unreadRow: '#2b2b2b', selectedRow: '#003b5f',
    rowShadow: 'inset 1px 0 0 #444, inset -1px 0 0 #444, 0 1px 3px 0 rgba(0,0,0,.6)',
    primary: '#a8c7fa',
  },
};

const fontFamily = '"Google Sans", Roboto, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';

const build = (base, mode) => {
  const gm = tokens[mode];
  return {
    ...base,
    palette: {
      ...base.palette,
      mode,
      primary: { main: gm.primary },
      secondary: { main: '#0e7490' },
      background: { default: gm.bg, paper: gm.surface },
      text: { primary: gm.text, secondary: gm.textSub },
      divider: gm.border,
      gm,
    },
    shape: { borderRadius: 8 },
    typography: { ...base.typography, fontFamily, button: { textTransform: 'none', fontWeight: 500 } },
    sidebar: { width: 256, closedWidth: 72 },
    components: {
      ...base.components,
      MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 20, paddingInline: 16 } } },
      MuiCard: { styleOverrides: { root: { boxShadow: 'none', border: `1px solid ${gm.border}`, borderRadius: 12, backgroundImage: 'none' } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } } },
      MuiTableCell: { styleOverrides: { root: { borderColor: gm.border }, head: { fontWeight: 600, color: gm.textSub, background: 'transparent' } } },
      MuiTableRow: { styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: gm.unreadRow, boxShadow: gm.rowShadow, position: 'relative', zIndex: 1 } } } },
      MuiFilledInput: { styleOverrides: { root: { borderRadius: 8, '&::before, &::after': { display: 'none' } } } },
      // react-admin 为没有提示文字的输入框也预留一行占位（只含零宽空格），隐藏掉以收紧表单间距；校验报错时仍然显示
      MuiFormHelperText: { styleOverrides: { root: { marginTop: 2, lineHeight: 1.3, '&:not(.Mui-error):has(> span:only-child)': { display: 'none' } } } },
      MuiFormControl: { styleOverrides: { marginDense: { marginTop: 6, marginBottom: 6 } } },
      MuiMenu: { styleOverrides: { paper: { borderRadius: 8 } } },
      MuiSnackbarContent: { styleOverrides: { root: { borderRadius: 8 } } },
      // 筛选栏（手机端）：搜索框与下拉框统一 40px 高
      RaFilterForm: { styleOverrides: { root: {
        alignItems: 'center',
        '& .MuiFilledInput-root, & .MuiOutlinedInput-root': { height: 40, paddingTop: 0 },
        '& .MuiSelect-select': { paddingTop: '8px !important', paddingBottom: '8px !important' },
        '& .RaFilterFormInput-body': { alignItems: 'center' },
      } } },
      RaList: { styleOverrides: { root: { '& .RaList-main': { minWidth: 0 }, '& .RaList-noActions': { marginTop: 0 }, '& .RaList-content': { border: 'none', borderRadius: 0, background: 'transparent' } } } },
      RaShow: { styleOverrides: { root: { '& .RaShow-card': { border: 'none', background: 'transparent' } } } },
      RaEdit: { styleOverrides: { root: { '& .RaEdit-card': { border: 'none', background: 'transparent' } } } },
      RaCreate: { styleOverrides: { root: { '& .RaCreate-card': { border: 'none', background: 'transparent' } } } },
      RaDatagrid: { styleOverrides: { root: { '& .RaDatagrid-headerCell': { background: gm.surface }, '& .RaDatagrid-row': { background: gm.readRow } } } },
    },
  };
};

export const lightTheme = build(defaultTheme, 'light');
export const darkTheme = build(defaultDarkTheme, 'dark');
