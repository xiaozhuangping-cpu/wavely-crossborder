-- 订单星标（Gmail 式标星）
alter table public.orders add column if not exists starred boolean not null default false;
update public.orders set starred = true where id in (select id from public.orders order by random() limit 12);
