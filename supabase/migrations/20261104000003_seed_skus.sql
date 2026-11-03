-- 演示数据改为 SPU + 多规格 SKU
create or replace function public.seed_demo()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d int; k int; j int; n_orders int;
  v_shop record; v_cust bigint; v_order bigint; v_prod record; v_qty int;
  v_rate numeric; v_total numeric; v_ts timestamptz; v_age numeric; v_status text;
  v_ship bigint; v_sstatus text; v_st text; v_steps text[] := array['label_created','picked_up','in_transit','customs','out_for_delivery','delivered'];
  v_carrier text; ev record; v_cnt int;
  first_names text[] := array['James','Emma','Liam','Olivia','Noah','Mia','Lukas','Sophie','Hiro','Yuki','Wei Ling','Aisyah','Oliver','Amelia','Ethan','Hannah','Ken','Sakura','Jia Hui','Arjun'];
  last_names  text[] := array['Smith','Johnson','Müller','Schmidt','Tanaka','Sato','Tan','Lim','Brown','Taylor','Wilson','Ahmad','Lee','Wagner','Suzuki','Wong'];
begin
  perform setseed(0.42);

  truncate tracking_events, shipments, order_items, orders, customers, inventory, skus, products,
           warehouses, shops, exchange_rates restart identity cascade;

  insert into exchange_rates (currency, rate_to_usd) values
    ('USD', 1), ('EUR', 1.08), ('GBP', 1.27), ('JPY', 0.0066), ('SGD', 0.74), ('MYR', 0.22), ('CNY', 0.138);

  insert into shops (platform, name, country, currency) values
    ('amazon', 'Amazon 美国站',      'US', 'USD'),
    ('amazon', 'Amazon 德国站',      'DE', 'EUR'),
    ('amazon', 'Amazon 日本站',      'JP', 'JPY'),
    ('shopee', 'Shopee 新加坡',      'SG', 'SGD'),
    ('shopee', 'Shopee 马来西亚',    'MY', 'MYR'),
    ('tiktok', 'TikTok Shop 英国',   'GB', 'GBP'),
    ('tiktok', 'TikTok Shop 美国',   'US', 'USD'),
    ('site',   'Wavely 独立站',      'US', 'USD');

  insert into warehouses (code, name, country, kind) values
    ('CN-SZ',  '深圳总仓',          'CN', 'domestic'),
    ('US-LAX', '洛杉矶海外仓',      'US', 'overseas'),
    ('DE-FRA', '法兰克福海外仓',    'DE', 'overseas'),
    ('US-FBA', 'Amazon FBA 美国',   'US', 'fba'),
    ('JP-FBA', 'Amazon FBA 日本',   'JP', 'fba');

  insert into products (sku, name, description, category, cost_cny, price_usd, weight_g) values
    ('WV-HOM-001', '{"zh":"折叠硅胶收纳篮","en":"Collapsible Silicone Basket","ja":"折りたたみシリコンバスケット","es":"Cesta plegable de silicona"}', '{"zh":"食品级硅胶，压扁后仅 2cm 厚","en":"Food-grade silicone, folds flat to 2 cm"}', '家居', 18.5, 15.99, 320),
    ('WV-HOM-002', '{"zh":"磁吸厨房置物架","en":"Magnetic Kitchen Rack","ja":"マグネットキッチンラック","es":"Estante magnético de cocina"}', '{"zh":"免打孔，吸附冰箱侧面","en":"No drilling, sticks to the fridge"}', '家居', 26, 22.99, 680),
    ('WV-HOM-003', '{"zh":"感应夜灯（3 只装）","en":"Motion Sensor Night Light (3-pack)","ja":"人感センサーライト 3個","es":"Luz nocturna con sensor (3 uds)"}', '{"zh":"USB-C 充电，暖光无频闪","en":"USB-C rechargeable, warm flicker-free light"}', '家居', 32, 27.99, 260),
    ('WV-OUT-001', '{"zh":"超轻户外折叠椅","en":"Ultralight Camping Chair","ja":"超軽量キャンプチェア","es":"Silla de camping ultraligera"}', '{"zh":"仅 900g，承重 150kg","en":"900 g, supports 150 kg"}', '户外', 68, 49.99, 1100),
    ('WV-OUT-002', '{"zh":"便携太阳能充电宝","en":"Solar Power Bank 20000mAh","ja":"ソーラーモバイルバッテリー","es":"Batería solar 20000mAh"}', '{"zh":"IP67 防水，自带手电","en":"IP67 waterproof with flashlight"}', '户外', 75, 39.99, 420),
    ('WV-OUT-003', '{"zh":"保温随行杯 600ml","en":"Insulated Tumbler 600ml","ja":"真空断熱タンブラー","es":"Vaso térmico 600ml"}', '{"zh":"保冷 24 小时","en":"Keeps drinks cold for 24 h"}', '户外', 22, 24.99, 380),
    ('WV-PET-001', '{"zh":"智能宠物饮水机","en":"Smart Pet Water Fountain","ja":"ペット自動給水器","es":"Fuente de agua para mascotas"}', '{"zh":"静音水泵，App 提醒换滤芯","en":"Silent pump, app filter reminders"}', '宠物', 85, 45.99, 1300),
    ('WV-PET-002', '{"zh":"猫抓板沙发","en":"Cat Scratcher Lounge","ja":"爪とぎソファ","es":"Rascador sofá para gatos"}', '{"zh":"高密度瓦楞纸","en":"High-density corrugated cardboard"}', '宠物', 28, 29.99, 1500),
    ('WV-PET-003', '{"zh":"宠物除毛滚刷","en":"Pet Hair Remover Roller","ja":"ペット毛取りローラー","es":"Rodillo quita pelos"}', '{"zh":"可重复使用，无需粘纸","en":"Reusable, no sticky sheets"}', '宠物', 9.8, 12.99, 200),
    ('WV-BEA-001', '{"zh":"便携补水喷雾仪","en":"Nano Facial Mister","ja":"ナノミスト美顔器","es":"Nebulizador facial"}', '{"zh":"纳米级细雾，Type-C 充电","en":"Nano mist, Type-C charging"}', '美妆', 24, 19.99, 120),
    ('WV-BEA-002', '{"zh":"LED 化妆镜","en":"LED Makeup Mirror","ja":"LED女優ミラー","es":"Espejo de maquillaje LED"}', '{"zh":"三色光，触控调光","en":"3 light modes, touch dimming"}', '美妆', 45, 34.99, 900),
    ('WV-ELE-001', '{"zh":"三合一磁吸无线充","en":"3-in-1 Magnetic Wireless Charger","ja":"3in1 マグネットワイヤレス充電器","es":"Cargador inalámbrico magnético 3 en 1"}', '{"zh":"手机、耳机、手表同时充","en":"Charges phone, earbuds and watch at once"}', '数码配件', 58, 39.99, 350),
    ('WV-ELE-002', '{"zh":"氮化镓快充 65W","en":"65W GaN Charger","ja":"65W GaN 充電器","es":"Cargador GaN 65W"}', '{"zh":"三口输出，可充笔记本","en":"3 ports, charges laptops"}', '数码配件', 48, 32.99, 160),
    ('WV-ELE-003', '{"zh":"机械键盘手托","en":"Wooden Keyboard Wrist Rest","ja":"木製パームレスト","es":"Reposamuñecas de madera"}', '{"zh":"胡桃木，人体工学弧度","en":"Walnut, ergonomic curve"}', '数码配件', 30, 25.99, 400),
    ('WV-ELE-004', '{"zh":"降噪蓝牙耳机","en":"ANC Wireless Earbuds","ja":"ノイズキャンセリングイヤホン","es":"Auriculares con cancelación de ruido"}', '{"zh":"主动降噪 -42dB，续航 36h","en":"-42 dB ANC, 36 h battery"}', '数码配件', 95, 59.99, 180),
    ('WV-HOM-004', '{"zh":"真空压缩收纳袋（8 只装）","en":"Vacuum Storage Bags (8-pack)","ja":"圧縮袋 8枚セット","es":"Bolsas al vacío (8 uds)"}', '{"zh":"附电动抽气泵","en":"Electric pump included"}', '家居', 35, 29.99, 1200);

  -- 规格 SKU、主图、规格名；保留 AI 生成的德语 Listing 作为演示
  perform seed_skus();
  update products set listing = '{"de": {"title": "Kratzsofa für Katzen aus hochdichtem Wellpappkarton – Kratzbrett mit Liegefläche, Kratzmöbel für Wohnzimmer, 1,5 kg", "bullets": ["Kratzen und Ausruhen in einem: Die gepolsterte Liegefläche lädt zum Entspannen ein, während die Kratzfläche die Krallenpflege unterstützt.", "Hochdichter Wellpappkarton: Mehrere fest verklebte Lagen sorgen für eine stabile, langlebige Kratzfläche und halten auch intensivem Kratzen stand.", "Schützt Polstermöbel: Ein fester Platz zum Kratzen hilft, Sofa, Sessel und Teppich vor Kratzspuren zu bewahren.", "Leicht und flexibel: Mit rund 1,5 kg lässt sich das Kratzmöbel einfach umstellen – im Wohnzimmer, Schlafzimmer oder Flur.", "Einfache Montage: Alle Teile sind vorbereitet, der Aufbau gelingt ohne Werkzeug in wenigen Minuten."], "updated_at": "2026-11-03T16:33:46.676Z", "description": "Das Kratzsofa für Katzen verbindet eine großzügige Kratzfläche mit einer bequemen Liegefläche – ein Möbelstück, das Ihre Katze zum Kratzen und Ausruhen nutzen kann. Die Kratzfläche besteht aus hochdichtem, mehrlagig verklebtem Wellpappkarton und ist damit stabil genug für den täglichen Gebrauch. Durch die kompakte Bauform passt das Kratzmöbel in viele Wohnbereiche und lässt sich dank des geringen Gewichts von etwa 1,5 kg jederzeit umstellen. Der Aufbau ist unkompliziert und ohne zusätzliches Werkzeug möglich. Bitte stellen Sie das Kratzsofa an einen ruhigen, gut erreichbaren Platz und reinigen Sie die Oberfläche gelegentlich mit einem trockenen Tuch oder einer weichen Bürste."}}'::jsonb where sku = 'WV-PET-002';

  insert into inventory (product_id, sku_id, warehouse_id, qty, safety_qty)
  select s.product_id, s.id, w.id,
         case when random() < 0.12 then floor(random() * 15)::int else 30 + floor(random() * 400)::int end,
         case w.kind when 'domestic' then 100 else 30 end
  from skus s cross join warehouses w;

  insert into customers (name, email, country, created_at)
  select fn || ' ' || ln,
         lower(replace(fn, ' ', '')) || '.' || lower(ln) || g || '@example.com',
         (array['US','US','US','DE','JP','SG','MY','GB','CA','AU'])[1 + floor(random() * 10)::int],
         now() - (random() * interval '180 days')
  from generate_series(1, 160) g,
       lateral (select first_names[1 + floor(random() * array_length(first_names, 1))::int] fn,
                       last_names[1 + floor(random() * array_length(last_names, 1))::int] ln
                where g is not null) x;   -- 引用 g，保证每行重新取随机名

  for d in reverse 89..0 loop
    n_orders := 3 + floor(random() * 6)::int + floor((89 - d) / 15.0)::int;   -- 订单量逐月增长
    for k in 1..n_orders loop
      select * into v_shop from shops order by random() limit 1;
      select rate_to_usd into v_rate from exchange_rates where currency = v_shop.currency;
      if v_shop.platform = 'site' then
        select id into v_cust from customers order by random() limit 1;
      else
        select id into v_cust from customers where country = v_shop.country order by random() limit 1;
        if v_cust is null then select id into v_cust from customers order by random() limit 1; end if;
      end if;

      v_ts  := date_trunc('day', now()) - make_interval(days => d) + random() * interval '23 hours';
      if v_ts > now() then v_ts := now() - random() * interval '3 hours'; end if;
      v_age := extract(epoch from now() - v_ts) / 86400.0;
      v_status := case
        when random() < 0.03 then 'cancelled'
        when v_age > 14 then case when random() < 0.04 then 'refunded' else 'delivered' end
        when v_age > 7  then case when random() < 0.6 then 'delivered' else 'in_transit' end
        when v_age > 2  then case when random() < 0.5 then 'in_transit' else 'shipped' end
        else case when random() < 0.85 then 'paid' else 'pending' end end;

      insert into orders (order_no, shop_id, customer_id, currency, total_amount, total_usd, country, status, source, created_at)
      values ('WV' || to_char(v_ts, 'YYMMDD') || lpad((floor(random() * 1000000))::int::text, 6, '0'),
              v_shop.id, v_cust, v_shop.currency, 0, 0,
              (select country from customers where id = v_cust), v_status,
              case when v_shop.platform = 'site' then 'site' else 'platform' end, v_ts)
      on conflict (order_no) do nothing
      returning id into v_order;
      continue when v_order is null;

      v_total := 0;
      for j in 1..(1 + floor(random() * random() * 3)::int) loop
        select s.product_id as id, s.id as sku_id, s.price_usd into v_prod from skus s order by random() limit 1;
        v_qty := 1 + floor(random() * random() * 3)::int;
        insert into order_items (order_id, product_id, sku_id, qty, unit_price)
        values (v_order, v_prod.id, v_prod.sku_id, v_qty,
                case when v_shop.currency = 'JPY' then round(v_prod.price_usd / v_rate, -1)
                     else round(v_prod.price_usd / v_rate, 2) end);
        v_total := v_total + v_prod.price_usd * v_qty;
      end loop;
      update orders set total_usd = round(v_total, 2),
                        total_amount = (select sum(qty * unit_price) from order_items where order_id = v_order)
      where id = v_order;

      if v_status in ('shipped','in_transit','delivered','refunded') then
        v_sstatus := case v_status
          when 'shipped' then (array['label_created','picked_up'])[1 + floor(random() * 2)::int]
          when 'in_transit' then (array['in_transit','customs','out_for_delivery'])[1 + floor(random() * 3)::int]
          else 'delivered' end;
        v_carrier := case v_shop.country when 'US' then 'UPS' when 'DE' then 'DHL' when 'GB' then 'Royal Mail'
                       when 'JP' then 'Yamato' when 'SG' then 'Ninja Van' when 'MY' then 'J&T Express' else 'YunExpress' end;
        insert into shipments (order_id, carrier, tracking_no, status, created_at, updated_at)
        values (v_order, v_carrier, 'YT' || lpad((floor(random() * 1e10))::bigint::text, 10, '0'), v_sstatus,
                v_ts + interval '20 hours', least(now(), v_ts + interval '20 hours' + (array_position(v_steps, v_sstatus) - 1) * interval '30 hours'))
        returning id into v_ship;
        v_cnt := 0;
        foreach v_st in array v_steps loop
          select * into ev from _ship_event(v_st, (select country from orders where id = v_order));
          insert into tracking_events (shipment_id, status, location, description, event_time)
          values (v_ship, v_st, ev.location, ev.description,
                  least(now(), v_ts + interval '20 hours' + v_cnt * interval '30 hours' + random() * interval '4 hours'));
          v_cnt := v_cnt + 1;
          exit when v_st = v_sstatus;
        end loop;
      end if;
    end loop;
  end loop;
end $$;

revoke execute on function public.seed_demo() from public, anon, authenticated;

-- 立即按新结构重灌演示数据，并随机标星
select public.seed_demo();
update public.orders set starred = true where id in (select id from public.orders order by random() limit 12);
