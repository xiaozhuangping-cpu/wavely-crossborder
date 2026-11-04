-- 商品视频：ERP 上传/管理，独立站详情页与首页短片区块展示
alter table public.products add column if not exists video_url text;
alter table public.products add column if not exists video_poster text;

-- 公开读取的媒体桶：单文件 ≤ 20 MB，仅允许视频与图片
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-media', 'product-media', true, 20971520,
        array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 登录用户（含匿名演示访客）可上传/替换/删除该桶内文件；公开桶的读取不需要策略
drop policy if exists "product_media_insert" on storage.objects;
drop policy if exists "product_media_update" on storage.objects;
drop policy if exists "product_media_delete" on storage.objects;
create policy "product_media_insert" on storage.objects for insert to authenticated with check (bucket_id = 'product-media');
create policy "product_media_update" on storage.objects for update to authenticated using (bucket_id = 'product-media') with check (bucket_id = 'product-media');
create policy "product_media_delete" on storage.objects for delete to authenticated using (bucket_id = 'product-media');

-- 演示数据自带的 4 条 AI 场景短片（Google Flow · Veo 3.1，静态文件在独立站 public/videos）
create or replace function public.seed_product_videos()
returns void
language sql
security definer
set search_path = public
as $$
  update products set
    video_url    = 'https://xiaozhuangping-cpu.github.io/wavely-crossborder/shop/videos/' || sku || '.mp4',
    video_poster = 'https://xiaozhuangping-cpu.github.io/wavely-crossborder/shop/videos/' || sku || '.jpg'
  where sku in ('WV-PET-001', 'WV-OUT-001', 'WV-ELE-001', 'WV-HOM-003') and video_url is null;
$$;
revoke execute on function public.seed_product_videos() from public, anon, authenticated;

-- 每日重置后补回演示视频
create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_demo();
  perform public.seed_product_videos();
  update public.orders set starred = true where id in (select id from public.orders order by random() limit 12);
  delete from auth.users where is_anonymous and created_at < now() - interval '1 day';
end $$;
revoke execute on function public.reset_demo() from public, anon, authenticated;

select public.seed_product_videos();
