-- Wavely 跨境电商演示：核心表结构
create extension if not exists pgcrypto;

create table public.shops (
  id          bigint generated always as identity primary key,
  platform    text not null check (platform in ('amazon','shopee','tiktok','temu','site')),
  name        text not null,
  country     text not null,           -- ISO 3166 alpha-2
  currency    text not null,           -- ISO 4217
  created_at  timestamptz not null default now()
);

create table public.warehouses (
  id       bigint generated always as identity primary key,
  code     text not null unique,
  name     text not null,
  country  text not null,
  kind     text not null check (kind in ('domestic','overseas','fba'))
);

create table public.products (
  id           bigint generated always as identity primary key,
  sku          text not null unique,
  name         jsonb not null,          -- {"zh": "...", "en": "...", "ja": "...", "es": "..."}
  description  jsonb not null default '{}'::jsonb,
  category     text not null,
  image_url    text,
  cost_cny     numeric(12,2) not null,  -- 采购成本（人民币）
  price_usd    numeric(12,2) not null,  -- 基准售价（美元）
  weight_g     int not null default 500,
  status       text not null default 'active' check (status in ('active','draft','archived')),
  created_at   timestamptz not null default now()
);

create table public.inventory (
  id            bigint generated always as identity primary key,
  product_id    bigint not null references public.products(id) on delete cascade,
  warehouse_id  bigint not null references public.warehouses(id) on delete cascade,
  qty           int not null default 0,
  safety_qty    int not null default 20,
  unique (product_id, warehouse_id)
);

create table public.customers (
  id          bigint generated always as identity primary key,
  name        text not null,
  email       text not null,
  country     text not null,
  created_at  timestamptz not null default now()
);

create table public.exchange_rates (
  currency    text primary key,
  rate_to_usd numeric(14,6) not null,   -- 1 单位该币种 = ? USD
  updated_at  timestamptz not null default now()
);

create table public.orders (
  id            bigint generated always as identity primary key,
  order_no      text not null unique,
  shop_id       bigint not null references public.shops(id),
  customer_id   bigint references public.customers(id),
  currency      text not null,
  total_amount  numeric(12,2) not null,
  total_usd     numeric(12,2) not null,
  country       text not null,
  status        text not null default 'paid'
                check (status in ('pending','paid','shipped','in_transit','delivered','cancelled','refunded')),
  source        text not null default 'platform' check (source in ('platform','site')),
  created_at    timestamptz not null default now()
);
create index on public.orders (created_at desc);
create index on public.orders (status);

create table public.order_items (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references public.orders(id) on delete cascade,
  product_id  bigint not null references public.products(id),
  qty         int not null check (qty > 0),
  unit_price  numeric(12,2) not null      -- 订单币种
);
create index on public.order_items (order_id);

create table public.shipments (
  id           bigint generated always as identity primary key,
  order_id     bigint not null references public.orders(id) on delete cascade,
  carrier      text not null,
  tracking_no  text not null,
  status       text not null default 'label_created'
               check (status in ('label_created','picked_up','in_transit','customs','out_for_delivery','delivered')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.shipments (order_id);

create table public.tracking_events (
  id           bigint generated always as identity primary key,
  shipment_id  bigint not null references public.shipments(id) on delete cascade,
  status       text not null,
  location     text not null,
  description  text not null,
  event_time   timestamptz not null default now()
);
create index on public.tracking_events (shipment_id, event_time);

-- ========== 视图（供看板使用） ==========
create view public.v_daily_sales with (security_invoker = true) as
  select date_trunc('day', o.created_at)::date as day,
         s.platform,
         count(*)                              as orders,
         sum(o.total_usd)                      as gmv_usd
  from public.orders o join public.shops s on s.id = o.shop_id
  where o.status not in ('cancelled','refunded')
  group by 1, 2;

create view public.v_country_sales with (security_invoker = true) as
  select o.country, count(*) as orders, sum(o.total_usd) as gmv_usd
  from public.orders o
  where o.status not in ('cancelled','refunded')
  group by 1;

create view public.v_inventory with (security_invoker = true) as
  select i.id, i.product_id, i.warehouse_id, p.sku, p.name->>'zh' as product_name,
         w.code as warehouse_code, w.name as warehouse_name, w.kind as warehouse_kind,
         i.qty, i.safety_qty, (i.qty < i.safety_qty) as low_stock
  from public.inventory i
  join public.products p on p.id = i.product_id
  join public.warehouses w on w.id = i.warehouse_id;

-- ========== RLS ==========
-- 访客：只能读商品/店铺/汇率，通过 place_order() 下单
-- 登录用户（含匿名登录的演示访客）：ERP 全部读写，每天凌晨重置
do $$
declare t text;
begin
  foreach t in array array['shops','warehouses','products','inventory','customers','exchange_rates',
                           'orders','order_items','shipments','tracking_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "erp_all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

create policy "public_read_products" on public.products for select to anon using (status = 'active');
create policy "public_read_shops"    on public.shops    for select to anon using (true);
create policy "public_read_rates"    on public.exchange_rates for select to anon using (true);

grant select on public.v_daily_sales, public.v_country_sales, public.v_inventory to authenticated;
