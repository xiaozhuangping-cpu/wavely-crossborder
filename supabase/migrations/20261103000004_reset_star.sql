create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_demo();
  update public.orders set starred = true where id in (select id from public.orders order by random() limit 12);
  delete from auth.users where is_anonymous and created_at < now() - interval '1 day';
end $$;
revoke execute on function public.reset_demo() from public, anon, authenticated;
