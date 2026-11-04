-- 在空的 Postgres 里模拟 Supabase 的最小环境，使全部迁移可以原样执行
-- （角色、默认权限、auth / storage 表、pg_cron 替身）。只用于测试，切勿在线上执行。
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

-- Supabase 默认权限：新建的表 / 序列 / 函数对 anon、authenticated 开放，由 RLS 与迁移里的 revoke 收紧
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(), is_anonymous boolean default true, created_at timestamptz default now());

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claims', true)::jsonb->>'sub', ''), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;

create schema if not exists extensions;
create schema if not exists cron;
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint
  language sql as 'select 1::bigint';

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);

-- 测试工具：t.throws(sql, pattern) 断言语句报错且错误信息匹配 LIKE 模式
create schema if not exists t;
create or replace function t.throws(p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like p_like then return; end if;
    raise exception 'expected error like "%", got "%"', p_like, sqlerrm;
  end;
  raise exception 'expected error like "%", but it succeeded: %', p_like, p_sql;
end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;
