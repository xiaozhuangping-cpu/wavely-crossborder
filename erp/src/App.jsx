import { Admin, Resource, CustomRoutes, Layout, Menu, defaultTheme, defaultDarkTheme, AppBar, TitlePortal } from 'react-admin';
import { Route } from 'react-router-dom';
import { Box, Chip } from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PeopleIcon from '@mui/icons-material/People';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import CalculateIcon from '@mui/icons-material/Calculate';

import { dataProvider, authProvider } from './supabase';
import { i18nProvider } from './i18n';
import { LoginPage } from './LoginPage';
import { Dashboard } from './Dashboard';
import { ProfitCalculator } from './ProfitCalculator';
import { OrderList, OrderShow, OrderEdit } from './resources/orders';
import { ProductList, ProductEdit, ProductCreate } from './resources/products';
import { InventoryList, InventoryEdit, ShopList, ShopEdit, ShopCreate, CustomerList, ShipmentList, RateList, RateEdit } from './resources/others';

const brand = { palette: { primary: { main: '#0e7490' }, secondary: { main: '#f59e0b' } }, shape: { borderRadius: 10 } };
const lightTheme = { ...defaultTheme, ...brand, palette: { ...defaultTheme.palette, ...brand.palette, background: { default: '#f4f7f8' } } };
const darkTheme = { ...defaultDarkTheme, ...brand, palette: { ...defaultDarkTheme.palette, ...brand.palette, mode: 'dark' } };

const MyMenu = () => (
  <Menu>
    <Menu.DashboardItem primaryText="经营看板" />
    <Menu.ResourceItem name="orders" />
    <Menu.ResourceItem name="products" />
    <Menu.Item to="/v_inventory" primaryText="库存" leftIcon={<WarehouseIcon />} />
    <Menu.ResourceItem name="shipments" />
    <Menu.ResourceItem name="shops" />
    <Menu.ResourceItem name="customers" />
    <Menu.ResourceItem name="exchange_rates" />
    <Menu.Item to="/profit" primaryText="利润计算器" leftIcon={<CalculateIcon />} />
  </Menu>
);

const MyAppBar = () => (
  <AppBar>
    <TitlePortal />
    <Box sx={{ display: { xs: 'none', sm: 'block' }, mr: 1 }}>
      <Chip size="small" label="演示数据 · 每日重置" sx={{ bgcolor: 'rgba(255,255,255,.18)', color: 'inherit' }} />
    </Box>
  </AppBar>
);

const MyLayout = ({ children }) => <Layout menu={MyMenu} appBar={MyAppBar}>{children}</Layout>;

export const App = () => (
  <Admin
    title="Wavely 跨境 ERP"
    dataProvider={dataProvider}
    authProvider={authProvider}
    i18nProvider={i18nProvider}
    loginPage={LoginPage}
    dashboard={Dashboard}
    layout={MyLayout}
    theme={lightTheme}
    darkTheme={darkTheme}
    requireAuth
    disableTelemetry
  >
    <Resource name="orders" list={OrderList} show={OrderShow} edit={OrderEdit} icon={ReceiptLongIcon} recordRepresentation="order_no" />
    <Resource name="products" list={ProductList} edit={ProductEdit} create={ProductCreate} icon={Inventory2Icon} recordRepresentation={(r) => r.name?.zh} />
    <Resource name="v_inventory" list={InventoryList} />
    <Resource name="inventory" edit={InventoryEdit} />
    <Resource name="shipments" list={ShipmentList} icon={LocalShippingIcon} />
    <Resource name="shops" list={ShopList} edit={ShopEdit} create={ShopCreate} icon={StorefrontIcon} recordRepresentation="name" />
    <Resource name="customers" list={CustomerList} icon={PeopleIcon} recordRepresentation="name" />
    <Resource name="exchange_rates" list={RateList} edit={RateEdit} icon={CurrencyExchangeIcon} />
    <Resource name="order_items" />
    <Resource name="tracking_events" />
    <Resource name="warehouses" />
    <CustomRoutes>
      <Route path="/profit" element={<ProfitCalculator />} />
    </CustomRoutes>
  </Admin>
);
