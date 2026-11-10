import { Admin, Resource, CustomRoutes } from 'react-admin';
import { Route } from 'react-router-dom';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PeopleIcon from '@mui/icons-material/People';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';

import { dataProvider, authProvider } from './supabase';
import { i18nProvider } from './i18n';
import { lightTheme, darkTheme } from './theme';
import { GmailLayout } from './GmailLayout';
import { LoginPage } from './LoginPage';
import { lazy, Suspense } from 'react';
import { LinearProgress } from '@mui/material';

// 看板依赖 recharts，单独拆包
const DashboardImpl = lazy(() => import('./Dashboard').then((m) => ({ default: m.Dashboard })));
const Dashboard = () => <Suspense fallback={<LinearProgress sx={{ m: 2 }} />}><DashboardImpl /></Suspense>;
import { ProfitCalculator } from './ProfitCalculator';
import { ImageWorkbench } from './resources/ImageWorkbench';
import { OrderList, OrderShow, OrderEdit } from './resources/orders';
import { ProductList, ProductEdit, ProductCreate } from './resources/products';
import { SkuList, SkuEdit, SkuCreate } from './resources/skus';
import { CollectBox } from './collect/CollectBox';
import { AuditLogList } from './resources/audit';
import { ReplenishmentList, PurchaseOrderList, PurchaseOrderShow, SupplierList, SupplierEdit, SupplierCreate } from './resources/purchasing';
import { InventoryList, InventoryEdit, ShopList, ShopEdit, ShopCreate, CustomerList, ShipmentList, RateList, RateEdit } from './resources/others';

const MyLayout = ({ children }) => <GmailLayout>{children}</GmailLayout>;

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
    <Resource name="v_skus" list={SkuList} />
    <Resource name="skus" edit={SkuEdit} create={SkuCreate} recordRepresentation="sku" />
    <Resource name="v_inventory" list={InventoryList} />
    <Resource name="inventory" edit={InventoryEdit} />
    <Resource name="shipments" list={ShipmentList} icon={LocalShippingIcon} />
    <Resource name="shops" list={ShopList} edit={ShopEdit} create={ShopCreate} icon={StorefrontIcon} recordRepresentation="name" />
    <Resource name="customers" list={CustomerList} icon={PeopleIcon} recordRepresentation="name" />
    <Resource name="import_drafts" list={CollectBox} icon={AddShoppingCartIcon} options={{ label: '1688 采集' }} />
    <Resource name="v_replenishment" list={ReplenishmentList} options={{ label: '补货建议' }} />
    <Resource name="purchase_orders" list={PurchaseOrderList} show={PurchaseOrderShow} options={{ label: '采购单' }} recordRepresentation="po_no" />
    <Resource name="purchase_order_items" />
    <Resource name="suppliers" list={SupplierList} edit={SupplierEdit} create={SupplierCreate} options={{ label: '供应商' }} recordRepresentation="name" />
    <Resource name="audit_log" list={AuditLogList} options={{ label: '操作日志' }} />
    <Resource name="exchange_rates" list={RateList} edit={RateEdit} icon={CurrencyExchangeIcon} />
    <Resource name="order_items" />
    <Resource name="tracking_events" />
    <Resource name="warehouses" />
    <CustomRoutes>
      <Route path="/image-workbench" element={<ImageWorkbench />} />
      <Route path="/profit" element={<ProfitCalculator />} />
    </CustomRoutes>
  </Admin>
);
