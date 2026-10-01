-- Nómina y ajustes son estrictamente personales (SPEC CA2.1)
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@prueba.local', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@prueba.local', now(), now());

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select lives_ok($$ insert into public.nomina (pagas, neto_ordinario, neto_extra) values (14, 200000, 200000) $$,
  'A guarda su nómina');
select lives_ok($$ insert into public.ajustes (minutos_inactividad) values (30) $$, 'A guarda sus ajustes');
select is((select user_id::text from public.nomina), 'aaaaaaaa-0000-0000-0000-000000000001', 'la nómina queda a nombre de A');

select throws_ok($$ insert into public.nomina (user_id, pagas, neto_ordinario) values ('bbbbbbbb-0000-0000-0000-000000000002', 12, 100) $$,
  '42501', null, 'A no puede crear la nómina de B');
select throws_ok($$ update public.nomina set pagas = 13 $$, '23514', null, 'solo 12 o 14 pagas');
select throws_ok($$ update public.nomina set meses_extra = '{6,13}' $$, '23514', null, 'los meses extra van de 1 a 12');
select throws_ok($$ update public.ajustes set minutos_inactividad = 1 $$, '23514', null,
  'la inactividad no puede bajar de 5 minutos');

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);

select is((select count(*)::int from public.nomina), 0, 'B no ve la nómina de A');
select is((select count(*)::int from public.ajustes), 0, 'B no ve los ajustes de A');
select results_eq(
  $$ with x as (update public.nomina set neto_ordinario = 1 returning 1) select count(*)::int from x $$,
  array[0], 'B no puede modificar la nómina de A');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.nomina $$, '42501', null, 'anon no puede leer nóminas');

reset role;
select * from finish();
rollback;
