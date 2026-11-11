-- Independent tables; no foreign keys to the resettable commerce demo.
create table public.lead_studio_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.lead_studio_admins enable row level security;
revoke all on public.lead_studio_admins from anon, authenticated;

create table public.lead_studio_leads (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  contact text not null check (char_length(trim(contact)) between 1 and 200),
  project_type text not null check (char_length(trim(project_type)) between 1 and 200),
  description text not null check (char_length(trim(description)) between 1 and 5000),
  budget text not null check (char_length(trim(budget)) between 1 and 200),
  timeline text not null check (char_length(trim(timeline)) between 1 and 200),
  source text not null check (char_length(trim(source)) between 1 and 200),
  status text not null default '待联系' check (status in ('待联系','沟通中','已报价','已成交','已关闭')),
  quote text not null default '' check (char_length(quote) <= 200),
  notes text not null default '' check (char_length(notes) <= 5000)
);
alter table public.lead_studio_leads enable row level security;
revoke all on public.lead_studio_leads from anon, authenticated;
grant select, update (status, quote, notes) on public.lead_studio_leads to authenticated;

create function public.lead_studio_is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.lead_studio_admins where user_id = (select auth.uid())) $$;
revoke all on function public.lead_studio_is_admin() from public;
grant execute on function public.lead_studio_is_admin() to authenticated;
create policy lead_admin_select on public.lead_studio_leads for select to authenticated using (public.lead_studio_is_admin());
create policy lead_admin_update on public.lead_studio_leads for update to authenticated using (public.lead_studio_is_admin()) with check (public.lead_studio_is_admin());

create function public.submit_lead_studio(p_name text, p_contact text, p_project_type text, p_description text, p_budget text, p_timeline text, p_source text) returns void
language sql security definer set search_path = ''
as $$ insert into public.lead_studio_leads (name, contact, project_type, description, budget, timeline, source) values (trim(p_name), trim(p_contact), trim(p_project_type), trim(p_description), trim(p_budget), trim(p_timeline), trim(p_source)); $$;
revoke all on function public.submit_lead_studio(text,text,text,text,text,text,text) from public;
grant execute on function public.submit_lead_studio(text,text,text,text,text,text,text) to anon, authenticated;
