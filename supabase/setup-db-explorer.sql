-- DB Domain: run this entire file once in Supabase > SQL Editor as postgres.
-- Discovers every application table in public and enables Postgres Changes.
-- Does NOT grant table access, disable RLS, create users, or change row policies.
-- Existing app users still need SELECT grants and appropriate RLS policies.
-- Re-run after adding tables to enable their Realtime publication membership.

begin;
set local lock_timeout = '5s';

create or replace function public.db_domain_tables()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname,
    'name', c.relname,
    'primaryKey', coalesce((
      select jsonb_agg(a.attname order by key.ordinality)
      from pg_catalog.pg_index i
      cross join lateral unnest(i.indkey) with ordinality as key(attnum, ordinality)
      join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attnum = key.attnum
      where i.indrelid = c.oid and i.indisprimary and key.ordinality <= i.indnkeyatts
    ), '[]'::jsonb),
    'columns', coalesce((
      select jsonb_agg(a.attname order by a.attnum)
      from pg_catalog.pg_attribute a
      where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    ), '[]'::jsonb),
    'canRead', pg_catalog.has_schema_privilege(current_user, n.oid, 'USAGE')
      and pg_catalog.has_table_privilege(current_user, c.oid, 'SELECT'),
    'isPartitioned', c.relkind = 'p',
    'realtimeEnabled', exists (
      select 1 from pg_catalog.pg_publication_tables p
      where p.pubname = 'supabase_realtime' and p.schemaname = n.nspname and p.tablename = c.relname
    ) or exists (
      select 1 from pg_catalog.pg_publication p
      where p.pubname = 'supabase_realtime' and (
        p.puballtables
        or exists (select 1 from pg_catalog.pg_publication_rel r where r.prpubid = p.oid and r.prrelid = c.oid)
        or exists (select 1 from pg_catalog.pg_publication_namespace s where s.pnpubid = p.oid and s.pnnspid = n.oid)
      )
    )
  ) order by n.nspname, c.relname), '[]'::jsonb)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p');
$function$;

revoke all on function public.db_domain_tables() from public, anon;
grant execute on function public.db_domain_tables() to authenticated;

do $setup$
declare
  item record;
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  -- UPDATE/DELETE must keep working after adding tables without primary keys.
  -- FULL adds old-row data to WAL; tables with a valid existing identity keep it.
  for item in
    select c.oid, n.nspname, c.relname, c.relreplident
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relpersistence = 'p'
      and (c.relreplident = 'n' or (c.relreplident = 'd' and not exists (
        select 1 from pg_catalog.pg_index i where i.indrelid = c.oid and i.indisprimary
      )))
  loop
    execute format('alter table %I.%I replica identity full', item.nspname, item.relname);
  end loop;

  -- Publish roots first; adding a partitioned root includes its descendants.
  for item in
    select c.oid, n.oid as schema_oid, n.nspname, c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relpersistence = 'p'
    order by c.relispartition, c.relkind desc, c.relname
  loop
    if not exists (
      select 1 from pg_catalog.pg_publication_tables p
      where p.pubname = 'supabase_realtime'
        and p.schemaname = item.nspname and p.tablename = item.relname
    ) and not exists (
      select 1 from pg_catalog.pg_publication p
      where p.pubname = 'supabase_realtime' and (
        p.puballtables
        or exists (select 1 from pg_catalog.pg_publication_rel r where r.prpubid = p.oid and r.prrelid = item.oid)
        or exists (select 1 from pg_catalog.pg_publication_namespace s where s.pnpubid = p.oid and s.pnnspid = item.schema_oid)
      )
    ) then
      execute format('alter publication supabase_realtime add table %I.%I', item.nspname, item.relname);
    end if;
  end loop;
end;
$setup$;

notify pgrst, 'reload schema';
commit;

-- Metadata only. In SQL Editor, canRead reflects postgres, not your app user.
select public.db_domain_tables() as tables;
