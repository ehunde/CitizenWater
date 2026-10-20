-- CitizenWater accesses reports through its Express server using the
-- server-only Supabase service role key. Do not grant these permissions to anon.
-- RLS should already be enabled on public.reports.
alter table public.reports enable row level security;
revoke all on table public.reports from anon, authenticated;
grant select, insert, update, delete on table public.reports to service_role;
