-- SPU + 多规格 SKU：商品(SPU) 下挂多个 SKU，库存与订单明细按 SKU 记录

-- ========== 结构 ==========
alter table public.products add column if not exists option_name jsonb not null default '{}'::jsonb;  -- 规格名，如 {"zh":"颜色","en":"Color"}

create table if not exists public.skus (
  id            bigint generated always as identity primary key,
  product_id    bigint not null references public.products(id) on delete cascade,
  sku           text not null unique,
  option_value  jsonb not null default '{}'::jsonb,       -- 规格值，如 {"zh":"鼠尾草绿","en":"Sage Green"}
  barcode       text unique,                              -- EAN-13
  price_usd     numeric(12,2) not null,
  cost_cny      numeric(12,2) not null,
  weight_g      int not null default 500,
  image_url     text,
  status        text not null default 'active' check (status in ('active','inactive')),
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists skus_product_idx on public.skus (product_id, sort);

alter table public.skus enable row level security;
create policy "erp_all" on public.skus for all to authenticated using (true) with check (true);
create policy "public_read_skus" on public.skus for select to anon using (status = 'active');

alter table public.inventory add column if not exists sku_id bigint references public.skus(id) on delete cascade;
alter table public.inventory drop constraint if exists inventory_product_id_warehouse_id_key;
alter table public.inventory add constraint inventory_sku_warehouse_key unique (sku_id, warehouse_id);
alter table public.order_items add column if not exists sku_id bigint references public.skus(id);

-- SPU 售价/成本 = 在售 SKU 的最低值（列表展示「起售价」）
create or replace function public.sync_product_price() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid bigint := coalesce(new.product_id, old.product_id);
begin
  update products p set
    price_usd = coalesce((select min(price_usd) from skus where product_id = pid and status = 'active'), p.price_usd),
    cost_cny  = coalesce((select min(cost_cny)  from skus where product_id = pid and status = 'active'), p.cost_cny)
  where p.id = pid;
  return null;
end $$;
drop trigger if exists skus_sync_price on public.skus;
create trigger skus_sync_price after insert or update or delete on public.skus for each row execute function public.sync_product_price();

-- EAN-13 校验位
create or replace function public.ean13(p_body text) returns text language sql immutable as $$
  select p_body || ((10 - (sum(substr(p_body, i, 1)::int * case when i % 2 = 0 then 3 else 1 end) % 10)) % 10)::text
  from generate_series(1, 12) i;
$$;

-- ========== 视图 ==========
drop view if exists public.v_inventory;
create view public.v_inventory with (security_invoker = true) as
  select i.id, i.sku_id, s.product_id, s.sku, p.name->>'zh' as product_name, s.option_value->>'zh' as option_label,
         w.code as warehouse_code, w.name as warehouse_name, w.kind as warehouse_kind,
         i.qty, i.safety_qty, (i.qty < i.safety_qty) as low_stock
  from public.inventory i
  join public.skus s on s.id = i.sku_id
  join public.products p on p.id = s.product_id
  join public.warehouses w on w.id = i.warehouse_id;

create or replace view public.v_skus with (security_invoker = true) as
  select s.id, s.product_id, s.sku, s.option_value, s.option_value->>'zh' as option_label, s.barcode,
         s.price_usd, s.cost_cny, s.weight_g, s.status, s.sort, s.created_at,
         coalesce(s.image_url, p.image_url) as image_url,
         p.sku as spu, p.name->>'zh' as product_name, p.category, p.option_name->>'zh' as option_name,
         coalesce((select sum(qty) from public.inventory i where i.sku_id = s.id), 0)::int as stock,
         exists (select 1 from public.inventory i where i.sku_id = s.id and i.qty < i.safety_qty) as low_stock
  from public.skus s join public.products p on p.id = s.product_id;
grant select on public.v_inventory, public.v_skus to authenticated;

-- ========== 独立站下单：按 SKU ==========
-- p_items: [{"sku_id": 1, "qty": 2}]（兼容旧格式 {"product_id": 1}，取该商品第一个在售 SKU）
create or replace function public.place_order(p_items jsonb, p_customer jsonb, p_currency text default 'USD')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_rate numeric; v_shop_id bigint; v_cust_id bigint; v_order_id bigint; v_order_no text;
  v_total_usd numeric := 0; v_item jsonb; v_qty int; v_wh bigint; v_sku record;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 10 then
    raise exception '购物车商品数量需在 1-10 之间';
  end if;
  if coalesce(length(p_customer->>'name'), 0) not between 1 and 80
     or coalesce(p_customer->>'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or coalesce(p_customer->>'country', '') !~ '^[A-Z]{2}$' then
    raise exception '收货人信息不完整';
  end if;
  select rate_to_usd into v_rate from exchange_rates where currency = upper(p_currency);
  if v_rate is null then raise exception '不支持的币种 %', p_currency; end if;
  select id into v_shop_id from shops where platform = 'site' order by id limit 1;
  select id into v_wh from warehouses where kind = 'overseas' order by id limit 1;

  insert into customers (name, email, country)
  values (left(p_customer->>'name', 80), left(p_customer->>'email', 120), p_customer->>'country') returning id into v_cust_id;
  v_order_no := 'WV' || to_char(now(), 'YYMMDD') || lpad((floor(random() * 1000000))::int::text, 6, '0');
  insert into orders (order_no, shop_id, customer_id, currency, total_amount, total_usd, country, status, source)
  values (v_order_no, v_shop_id, v_cust_id, upper(p_currency), 0, 0, p_customer->>'country', 'paid', 'site') returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty not between 1 and 10 then raise exception '单个商品数量需在 1-10 之间'; end if;
    select s.* into v_sku from skus s join products p on p.id = s.product_id
    where s.status = 'active' and p.status = 'active'
      and (s.id = (v_item->>'sku_id')::bigint or (v_item->>'sku_id' is null and s.product_id = (v_item->>'product_id')::bigint))
    order by s.sort, s.id limit 1;
    if v_sku.id is null then raise exception '商品不存在或已下架'; end if;
    insert into order_items (order_id, product_id, sku_id, qty, unit_price)
    values (v_order_id, v_sku.product_id, v_sku.id, v_qty, round(v_sku.price_usd / v_rate, 2));
    v_total_usd := v_total_usd + v_sku.price_usd * v_qty;
    update inventory set qty = greatest(qty - v_qty, 0) where sku_id = v_sku.id and warehouse_id = v_wh;
  end loop;

  update orders set total_usd = round(v_total_usd, 2), total_amount = round(v_total_usd / v_rate, 2) where id = v_order_id;
  return v_order_no;
end $$;
revoke execute on function public.place_order(jsonb, jsonb, text) from public;
grant execute on function public.place_order(jsonb, jsonb, text) to anon, authenticated;

-- 畅销排行：金额按 SKU 价计算
create or replace function public.ai_top_products(p_start date, p_end date, p_country text default null,
                                                  p_platform text default null, p_limit int default 5)
returns table (product_id bigint, sku text, name text, category text, qty bigint, gmv_usd numeric)
language sql stable security invoker set search_path = public as $$
  select p.id, p.sku, p.name->>'zh', p.category, sum(i.qty), round(sum(i.qty * coalesce(k.price_usd, p.price_usd)), 2)
  from order_items i
  join orders o on o.id = i.order_id
  join shops s on s.id = o.shop_id
  join products p on p.id = i.product_id
  left join skus k on k.id = i.sku_id
  where (o.created_at at time zone 'Asia/Shanghai')::date between p_start and p_end
    and o.status not in ('cancelled', 'refunded')
    and (p_country is null or o.country = upper(p_country))
    and (p_platform is null or s.platform = lower(p_platform))
  group by 1, 2, 3, 4 order by 6 desc
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

-- ========== 演示数据：规格定义 ==========
create table if not exists public.demo_variants (
  spu text, code text, dim text, v_zh text, v_en text, v_de text, delta numeric, sort int
);
alter table public.demo_variants enable row level security;   -- 仅供 seed 使用
truncate public.demo_variants;
insert into public.demo_variants values
  ('WV-HOM-001','GRN','color','鼠尾草绿','Sage Green','Salbeigrün',0,1), ('WV-HOM-001','GRY','color','雾霾灰','Mist Grey','Nebelgrau',0,2), ('WV-HOM-001','CRM','color','奶油白','Cream','Creme',0,3),
  ('WV-HOM-002','BLK','color','磨砂黑','Matte Black','Mattschwarz',0,1), ('WV-HOM-002','WHT','color','白色','White','Weiß',0,2),
  ('WV-HOM-003','P3','pack','3 只装','3-pack','3er-Pack',0,1), ('WV-HOM-003','P6','pack','6 只装','6-pack','6er-Pack',20,2),
  ('WV-HOM-004','P8','pack','8 只装','8-pack','8er-Pack',0,1), ('WV-HOM-004','P12','pack','12 只装','12-pack','12er-Pack',10,2),
  ('WV-OUT-001','GRN','color','森林绿','Forest Green','Waldgrün',0,1), ('WV-OUT-001','BLK','color','碳黑','Carbon Black','Carbonschwarz',0,2),
  ('WV-OUT-002','STD','pack','标准款','Standard','Standard',0,1),
  ('WV-OUT-003','BLU','color','海洋蓝','Ocean Blue','Ozeanblau',0,1), ('WV-OUT-003','COR','color','珊瑚橙','Coral','Koralle',0,2), ('WV-OUT-003','IVY','color','象牙白','Ivory','Elfenbein',0,3),
  ('WV-PET-001','2L','capacity','2 升','2 L','2 L',0,1), ('WV-PET-001','3L','capacity','3 升','3 L','3 L',8,2),
  ('WV-PET-002','STD','size','标准','Standard','Standard',0,1), ('WV-PET-002','LRG','size','加大','Large','Groß',10,2),
  ('WV-PET-003','STD','pack','标准款','Standard','Standard',0,1),
  ('WV-BEA-001','PNK','color','珍珠粉','Pearl Pink','Perlrosa',0,1), ('WV-BEA-001','MNT','color','薄荷绿','Mint','Mint',0,2),
  ('WV-BEA-002','8IN','size','8 英寸','8 inch','8 Zoll',0,1), ('WV-BEA-002','10IN','size','10 英寸','10 inch','10 Zoll',10,2),
  ('WV-ELE-001','WHT','color','白色','White','Weiß',0,1), ('WV-ELE-001','BLK','color','黑色','Black','Schwarz',0,2),
  ('WV-ELE-002','STD','pack','标准款','Standard','Standard',0,1),
  ('WV-ELE-003','TKL','size','标准（87 键）','Tenkeyless','Tenkeyless',0,1), ('WV-ELE-003','FUL','size','全尺寸','Full-size','Volle Größe',5,2),
  ('WV-ELE-004','BLK','color','曜石黑','Obsidian Black','Obsidianschwarz',0,1), ('WV-ELE-004','WHT','color','云白','Cloud White','Wolkenweiß',0,2);

create or replace function public.dim_name(p_dim text) returns jsonb language sql immutable as $$
  select case p_dim
    when 'color'    then '{"zh":"颜色","en":"Color","de":"Farbe","ja":"カラー","es":"Color"}'
    when 'pack'     then '{"zh":"规格","en":"Pack","de":"Packung","ja":"セット","es":"Paquete"}'
    when 'capacity' then '{"zh":"容量","en":"Capacity","de":"Volumen","ja":"容量","es":"Capacidad"}'
    when 'size'     then '{"zh":"尺寸","en":"Size","de":"Größe","ja":"サイズ","es":"Tamaño"}'
    else '{}' end::jsonb;
$$;

-- 给已有商品补上 SKU 结构（由 seed_demo 调用；也可单独执行）
create or replace function public.seed_skus() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into skus (product_id, sku, option_value, barcode, price_usd, cost_cny, weight_g, sort)
  select p.id, p.sku || '-' || v.code,
         jsonb_build_object('zh', v.v_zh, 'en', v.v_en, 'de', v.v_de),
         ean13('69' || lpad(p.id::text, 4, '0') || lpad((row_number() over (order by p.id, v.sort))::text, 6, '0')),
         p.price_usd + v.delta, round(p.cost_cny + v.delta * 0.35 * 7.2, 2), p.weight_g + (v.delta * 15)::int, v.sort
  from products p join demo_variants v on v.spu = p.sku;
  update products p set option_name = dim_name((select dim from demo_variants v where v.spu = p.sku limit 1)),
                        image_url = 'https://xiaozhuangping-cpu.github.io/wavely-crossborder/shop/products/' || p.sku || '.jpg';
end $$;
revoke execute on function public.seed_skus(), public.ean13(text), public.dim_name(text) from public, anon;
