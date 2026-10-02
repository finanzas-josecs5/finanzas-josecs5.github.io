-- La cartera es estrictamente personal (SPEC CA2.1, F8)
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@prueba.local', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@prueba.local', now(), now());

create temp table ref (fondo_a uuid) on commit drop;
grant select, insert, update on ref to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select lives_ok($$ insert into public.fondos (nombre, isin, ter) values ('MSCI World', 'IE00B4L5Y983', 0.2) $$, 'A da de alta un fondo');
insert into ref values ((select id from public.fondos));
select lives_ok($$ insert into public.aportaciones (fondo_id, fecha, importe) values ((select fondo_a from ref), '2025-01-01', 100000) $$,
  'A apunta una aportación');
select lives_ok($$ insert into public.valoraciones (fondo_id, fecha, valor) values ((select fondo_a from ref), '2026-01-01', 110000) $$,
  'A apunta una valoración');
select throws_ok($$ insert into public.fondos (nombre, isin) values ('Malo', 'ie00b4l5y983') $$, '23514', null,
  'el ISIN debe tener el formato correcto');
select throws_ok($$ insert into public.valoraciones (fondo_id, fecha, valor) values ((select fondo_a from ref), '2026-01-01', 1) $$,
  '23505', null, 'una sola valoración por fondo y día');

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::int from public.fondos), 0, 'B no ve los fondos de A');
select is((select count(*)::int from public.aportaciones) + (select count(*)::int from public.valoraciones), 0,
  'B no ve las aportaciones ni las valoraciones de A');
select throws_ok($$ insert into public.aportaciones (fondo_id, fecha, importe) values ((select fondo_a from ref), '2025-02-01', 100) $$,
  '23503', null, 'B no puede apuntar en un fondo de A');
select results_eq(
  $$ with x as (delete from public.fondos returning 1) select count(*)::int from x $$,
  array[0], 'B no puede borrar los fondos de A');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.fondos $$, '42501', null, 'anon no puede leer fondos');

reset role;
select * from finish();
rollback;
