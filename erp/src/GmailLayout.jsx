import { lazy, Suspense, useState } from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { useSidebarState, useGetList, LoadingIndicator, ToggleThemeButton, useLogout, CheckForApplicationUpdate } from 'react-admin';
import {
  Box, IconButton, Avatar, Tooltip, Drawer, Typography, Menu, MenuItem, ListItemIcon, Fab, useMediaQuery, Divider,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AppsIcon from '@mui/icons-material/Apps';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import LabelIcon from '@mui/icons-material/Label';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import LanguageIcon from '@mui/icons-material/Language';
import { PLATFORMS } from './constants';
import { Sparkle } from './ai/Sparkle';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import { useExtension } from './collect/extension';
import { RoleSwitcher, useRole } from './auth/role';
import HistoryIcon from '@mui/icons-material/History';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';

// AI 面板（assistant-ui、Markdown、图表）首次打开时才加载
const AssistantPanel = lazy(() => import('./ai/AssistantPanel'));

import { OrderSearch, ordersUrl } from './OrderSearch';
const ordersOf = (filter = {}) => `/purchase_orders?filter=${encodeURIComponent(JSON.stringify(filter))}`;

const useCount = (resource, filter) => {
  const { total } = useGetList(resource, { filter, pagination: { page: 1, perPage: 1 }, sort: { field: 'id', order: 'ASC' } });
  return total;
};

const currentFilter = (search) => {
  try { return JSON.parse(new URLSearchParams(search).get('filter') || '{}'); } catch { return {}; }
};

const Logo = ({ compact }) => (
  <Box component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', color: 'gm.textSub', pr: 2 }}>
    <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0e7490" />
      <path d="M10 38c8-10 14-10 22 0s14 10 22 0" stroke="#c2e7ff" strokeWidth="7" fill="none" strokeLinecap="round" />
    </svg>
    {!compact && <Typography sx={{ fontSize: 22, color: 'text.secondary', letterSpacing: '-.2px' }}>Wavely</Typography>}
  </Box>
);

const AppsMenu = () => {
  const [el, setEl] = useState(null);
  const base = 'https://xiaozhuangping-cpu.github.io';
  return (
    <>
      <Tooltip title="应用"><IconButton onClick={(e) => setEl(e.currentTarget)}><AppsIcon /></IconButton></Tooltip>
      <Menu anchorEl={el} open={!!el} onClose={() => setEl(null)}>
        <MenuItem component="a" href={`${base}/`}><ListItemIcon><HomeOutlinedIcon /></ListItemIcon>作者博客</MenuItem>
        <MenuItem component="a" href={`${base}/wavely-crossborder/`}><ListItemIcon><LanguageIcon /></ListItemIcon>演示入口</MenuItem>
        <MenuItem component={RouterLink} to="/import_drafts" onClick={() => setEl(null)}><ListItemIcon><ExtensionOutlinedIcon /></ListItemIcon>1688 采集插件</MenuItem>
      </Menu>
    </>
  );
};

const UserAvatar = () => {
  const [el, setEl] = useState(null);
  const logout = useLogout();
  return (
    <>
      <IconButton onClick={(e) => setEl(e.currentTarget)} sx={{ p: 0.5 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: '#0e7490', fontSize: 15 }}>访</Avatar>
      </IconButton>
      <Menu anchorEl={el} open={!!el} onClose={() => setEl(null)}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>演示访客</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>匿名登录 · 数据每日 03:00 重置</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>本系统由 AI 辅助生成</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => logout()}><ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>退出演示</MenuItem>
      </Menu>
    </>
  );
};

// 顶栏入口：未安装采集插件时提示安装，装好后自动隐藏
const CollectorButton = () => {
  const { status } = useExtension();
  if (status !== 'missing') return null;
  return (
    <Tooltip title="在 1688 勾选商品，一键采集到 ERP">
      <Box component={RouterLink} to="/import_drafts" sx={(t) => ({ display: { xs: 'none', md: 'inline-flex' }, alignItems: 'center', gap: 0.75, height: 36, px: 1.5, mr: 0.5,
        borderRadius: 18, textDecoration: 'none', fontSize: 14, fontWeight: 500, color: t.palette.gm.composeText, bgcolor: t.palette.gm.compose,
        '&:hover': { bgcolor: t.palette.gm.composeHover } })}>
        <ExtensionOutlinedIcon sx={{ fontSize: 18 }} />安装采集插件
      </Box>
    </Tooltip>
  );
};

const TopBar = ({ onMenu, onAi, aiOpen }) => {
  const small = useMediaQuery((t) => t.breakpoints.down('sm'));
  return (
    <Box component="header" sx={{ height: 64, display: 'flex', alignItems: 'center', gap: 1, pl: { xs: 1, sm: 1.5, md: 0 }, pr: { xs: 1, sm: 1.5 }, flexShrink: 0 }}>
      {/* 桌面端左侧区块宽 248 + 间距 8 = 侧边栏 256，搜索框左缘与主面板左缘对齐 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, width: { md: 248 }, pl: { md: 1.5 } }}>
        <IconButton onClick={onMenu} aria-label="主菜单"><MenuIcon /></IconButton>
        {!small && <Logo />}
      </Box>
      <OrderSearch />
      <Box sx={{ flex: { md: 1 } }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <Box sx={{ display: { xs: 'none', sm: 'flex' } }}><RoleSwitcher /></Box>
        <CollectorButton />
        <Tooltip title="AI 运营助手">
          <IconButton onClick={onAi} aria-label="AI 运营助手" aria-pressed={aiOpen}
            sx={(t) => ({ bgcolor: aiOpen ? t.palette.gm.navActive : 'transparent' })}>
            <Sparkle size={22} />
          </IconButton>
        </Tooltip>
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}>
          <LoadingIndicator />
          <ToggleThemeButton />
          <AppsMenu />
        </Box>
        <UserAvatar />
      </Box>
    </Box>
  );
};

const NavItem = ({ to, icon, label, count, active, collapsed, onClick, bold }) => (
  <Tooltip title={collapsed ? label : ''} placement="right">
    <Box component={RouterLink} to={to} onClick={onClick}
      sx={(t) => ({
        display: 'flex', alignItems: 'center', gap: 2, height: 32, textDecoration: 'none', cursor: 'pointer',
        color: active ? t.palette.gm.navActiveText : t.palette.text.primary,
        bgcolor: active ? t.palette.gm.navActive : 'transparent',
        fontWeight: active || bold ? 700 : 400, fontSize: 14,
        borderRadius: collapsed ? '16px' : '0 16px 16px 0',
        mx: collapsed ? 1.5 : 0, mr: collapsed ? 1.5 : 2,
        pl: collapsed ? 0 : 3.25, pr: collapsed ? 0 : 1.5, justifyContent: collapsed ? 'center' : 'flex-start',
        width: collapsed ? 48 : 'auto',
        '&:hover': { bgcolor: active ? t.palette.gm.navActive : t.palette.gm.navHover },
        '& svg': { fontSize: 20 },
      })}>
      {icon}
      {!collapsed && <Box component="span" sx={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>}
      {!collapsed && count > 0 && <Box component="span" sx={{ fontSize: 12, fontWeight: 700 }}>{count.toLocaleString()}</Box>}
    </Box>
  </Tooltip>
);

const SectionTitle = ({ children, collapsed }) =>
  collapsed ? <Divider sx={{ my: 1, mx: 2 }} /> : (
    <Typography sx={{ fontSize: 16, fontWeight: 500, pl: 3.25, pt: 2, pb: 0.5, color: 'text.primary' }}>{children}</Typography>
  );

const Sidebar = ({ collapsed, onNavigate }) => {
  const { pathname, search } = useLocation();
  const f = currentFilter(search);
  const onOrders = pathname.startsWith('/orders') && !pathname.includes('/show') ? true : false;
  const paid = useCount('orders', { status: 'paid' });
  const transit = useCount('orders', { 'status@in': '(shipped,in_transit)' });
  const lowStock = useCount('v_inventory', { low_stock: true });
  const collected = useCount('import_drafts', { status: 'new' });
  const toReplenish = useCount('v_replenishment', {});
  const openPOs = useCount('purchase_orders', { 'status@in': '(draft,placed,partial)' });
  const toApprove = useCount('purchase_orders', { status: 'approval' });
  const { role } = useRole();
  const { data: shops = [] } = useGetList('shops', { pagination: { page: 1, perPage: 20 }, sort: { field: 'id', order: 'ASC' } });

  const isOrders = (pred) => onOrders && pred(f);
  const items = [
    { to: '/', icon: <SpaceDashboardOutlinedIcon />, label: '经营看板', active: pathname === '/' },
    { to: ordersUrl(), icon: <InboxOutlinedIcon />, label: '全部订单', count: paid, bold: paid > 0,
      active: isOrders((x) => !x.status && !x['status@in'] && !x.starred && !x.shop_id) },
    { to: ordersUrl({ starred: true }), icon: <StarBorderIcon />, label: '星标订单', active: isOrders((x) => x.starred) },
    { to: ordersUrl({ status: 'paid' }), icon: <ScheduleIcon />, label: '待发货', count: paid, active: isOrders((x) => x.status === 'paid') },
    { to: ordersUrl({ 'status@in': '(shipped,in_transit)' }), icon: <LocalShippingOutlinedIcon />, label: '运输中', count: transit,
      active: isOrders((x) => x['status@in'] === '(shipped,in_transit)') },
    { to: ordersUrl({ 'status@in': '(refunded,cancelled)' }), icon: <AssignmentReturnOutlinedIcon />, label: '售后',
      active: isOrders((x) => x['status@in'] === '(refunded,cancelled)') },
  ];
  const manage = [
    { to: '/products', icon: <Inventory2OutlinedIcon />, label: '商品 (SPU)' },
    { to: '/v_skus', icon: <QrCode2Icon />, label: 'SKU 管理' },
    { to: '/import_drafts', icon: <AddShoppingCartIcon />, label: '1688 采集', count: collected },
    { to: '/v_inventory', icon: <WarehouseOutlinedIcon />, label: '库存', count: lowStock },
    { to: '/shipments', icon: <LocalShippingOutlinedIcon />, label: '物流' },
    { to: '/customers', icon: <PeopleOutlinedIcon />, label: '客户' },
    { to: '/shops', icon: <StorefrontOutlinedIcon />, label: '店铺' },
    { to: '/exchange_rates', icon: <CurrencyExchangeIcon />, label: '汇率' },
    { to: '/profit', icon: <CalculateOutlinedIcon />, label: '利润计算器' },
    { to: '/audit_log', icon: <HistoryIcon />, label: '操作日志' },
  ].map((x) => ({ ...x, active: pathname.startsWith(x.to) || (x.to === '/v_inventory' && pathname.startsWith('/inventory')) || (x.to === '/v_skus' && pathname.startsWith('/skus')) }));
  const purchasing = [
    { to: '/v_replenishment', icon: <ShoppingCartCheckoutIcon />, label: '补货建议', count: toReplenish, bold: toReplenish > 0 },
    { to: ordersOf({ status: 'approval' }), icon: <GavelOutlinedIcon />, label: '待审批', count: toApprove, bold: role === 'owner' && toApprove > 0,
      match: (p) => p.startsWith('/purchase_orders') && f.status === 'approval' },
    // 显式传空筛选，避免 react-admin 从列表存储中恢复上次的「待审批」筛选。
    { to: ordersOf(), icon: <ReceiptOutlinedIcon />, label: '采购单', count: openPOs, match: (p) => p.startsWith('/purchase_orders') && f.status !== 'approval' },
    { to: '/suppliers', icon: <FactoryOutlinedIcon />, label: '供应商' },
  ].map((x) => ({ ...x, active: x.match ? x.match(pathname) : pathname.startsWith(x.to) }));

  return (
    <Box component="nav" sx={{ width: collapsed ? 72 : 256, flexShrink: 0, overflowY: 'auto', overflowX: 'hidden', pb: 2, transition: 'width .2s' }}>
      <Box sx={{ px: collapsed ? 1 : 1, py: 1, pb: 2 }}>
        <Box component={RouterLink} to="/products/create" onClick={onNavigate}
          sx={(t) => ({
            display: 'inline-flex', alignItems: 'center', gap: 1.5, height: 56, borderRadius: 4, textDecoration: 'none',
            px: collapsed ? 0 : 2.5, width: collapsed ? 56 : 'auto', justifyContent: 'center', ml: collapsed ? 0 : 0,
            bgcolor: t.palette.gm.compose, color: t.palette.gm.composeText, fontWeight: 500, fontSize: 14,
            transition: 'box-shadow .15s', '&:hover': { boxShadow: '0 1px 3px 0 rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)' },
          })}>
          <EditOutlinedIcon />
          {!collapsed && '新建商品'}
        </Box>
      </Box>
      {items.map((x) => <NavItem key={x.label} {...x} collapsed={collapsed} onClick={onNavigate} />)}
      <SectionTitle collapsed={collapsed}>管理</SectionTitle>
      {manage.map((x) => <NavItem key={x.label} {...x} collapsed={collapsed} onClick={onNavigate} />)}
      <SectionTitle collapsed={collapsed}>采购</SectionTitle>
      {purchasing.map((x) => <NavItem key={x.label} {...x} collapsed={collapsed} onClick={onNavigate} />)}
      <SectionTitle collapsed={collapsed}>店铺标签</SectionTitle>
      {shops.map((s) => (
        <NavItem key={s.id} to={ordersUrl({ shop_id: s.id })} label={s.name} collapsed={collapsed} onClick={onNavigate}
          active={isOrders((x) => x.shop_id === s.id)} icon={<LabelIcon sx={{ color: PLATFORMS[s.platform]?.color }} />} />
      ))}
    </Box>
  );
};

export const GmailLayout = ({ children }) => {
  const [open, setOpen] = useSidebarState();
  const isMobile = useMediaQuery((t) => t.breakpoints.down('md'));
  const [drawer, setDrawer] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);
  const { pathname } = useLocation();
  // 订单收件箱与各列表页（/资源名）贴边铺满面板；看板、利润计算器、编辑页保留内边距
  const flush = pathname.startsWith('/orders') || (!isMobile && /^\/[a-z_]+\/?$/.test(pathname) && pathname !== '/profit');
  const panel = aiLoaded && (
    <Suspense fallback={<Box sx={{ flex: 1, display: 'grid', placeItems: 'center', bgcolor: 'background.paper' }}><Sparkle size={28} /></Box>}>
      <AssistantPanel onClose={() => setAiOpen(false)} />
    </Suspense>
  );

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'gm.bg', color: 'text.primary', overflow: 'hidden' }}>
      <TopBar onMenu={() => (isMobile ? setDrawer(true) : setOpen(!open))} onAi={() => { setAiLoaded(true); setAiOpen((v) => !v); }} aiOpen={aiOpen} />
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {isMobile ? (
          <Drawer open={drawer} onClose={() => setDrawer(false)} slotProps={{ paper: { sx: { bgcolor: 'gm.bg', width: 280 } } }}>
            <Box sx={{ p: 2, pb: 1 }}><Logo /></Box>
            <Sidebar collapsed={false} onNavigate={() => setDrawer(false)} />
          </Drawer>
        ) : (
          <Sidebar collapsed={!open} />
        )}
        <Box component="main" id="main-content"
          sx={{ flex: 1, minWidth: 0, overflow: 'auto', bgcolor: 'background.paper',
                borderRadius: { md: 4 }, mr: { md: 2 }, mb: { md: 2 } }}>
          {flush ? children : <Box sx={{ px: { xs: 1.5, md: 3 }, pb: { xs: 10, md: 2 } }}>{children}</Box>}
        </Box>
        {/* AI 面板：桌面端在右侧常驻（关闭时只隐藏，保留对话），手机端为右侧抽屉 */}
        {!isMobile && (
          <Box sx={{ width: 400, flexShrink: 0, display: aiOpen ? 'flex' : 'none', mr: 2, mb: 2, borderRadius: 4, overflow: 'hidden' }}>
            {panel}
          </Box>
        )}
      </Box>
      {isMobile && (
        <Drawer anchor="right" open={aiOpen} onClose={() => setAiOpen(false)} keepMounted
          slotProps={{ paper: { sx: { width: '100vw', maxWidth: 480 } } }}>
          {panel}
        </Drawer>
      )}
      {isMobile && !pathname.includes('/create') && (
        <Fab variant="extended" component={RouterLink} to="/products/create"
          sx={(t) => ({ position: 'fixed', right: 16, bottom: 20, bgcolor: t.palette.gm.compose, color: t.palette.gm.composeText, borderRadius: 4, '&:hover': { bgcolor: t.palette.gm.composeHover } })}>
          <EditOutlinedIcon sx={{ mr: 1 }} />新建商品
        </Fab>
      )}
      <CheckForApplicationUpdate />
    </Box>
  );
};
