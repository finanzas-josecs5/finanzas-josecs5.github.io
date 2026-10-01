-- RLS e integridad de recurrencias (SPEC CA4.4, CA2.1)
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@prueba.local', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@prueba.local', now(), now());

create temp table ref on commit drop as
select
  (select espacio_id from public.miembros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') as esp_a,
  (select espacio_id from public.miembros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') as esp_b;
alter table ref add column cat_a uuid, add column cat_b uuid, add column rec_a uuid;
update ref set
  cat_a = (select id from public.categorias where espacio_id = ref.esp_a and nombre = 'Suscripciones'),
  cat_b = (select id from public.categorias where espacio_id = ref.esp_b and nombre = 'Suscripciones');
grant select, update on ref to authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.recurrencias'::regclass), 'RLS activa en recurrencias');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select lives_ok($$
  insert into public.recurrencias (espacio_id, sentido, importe, categoria_id, comercio, frecuencia, desde)
  values ((select esp_a from ref), 'salida', 1299, (select cat_a from ref), 'Netflix', 'mensual', '2026-01-01')
$$, 'A crea una recurrencia mensual');
update ref set rec_a = (select id from public.recurrencias);

select lives_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, recurrencia_id, ocurrencia)
  values ((select esp_a from ref), '2026-02-02', 1399, 'salida', (select cat_a from ref), (select rec_a from ref), '2026-02-01')
$$, 'A confirma (ajustada) la ocurrencia de febrero');

select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, recurrencia_id, ocurrencia)
  values ((select esp_a from ref), '2026-02-03', 1299, 'salida', (select cat_a from ref), (select rec_a from ref), '2026-02-01')
$$, '23505', null, 'una ocurrencia no se puede confirmar dos veces');

select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, recurrencia_id)
  values ((select esp_a from ref), '2026-03-01', 1299, 'salida', (select cat_a from ref), (select rec_a from ref))
$$, '23514', null, 'un movimiento de una recurrencia debe indicar su ocurrencia');

select throws_ok($$
  insert into public.recurrencias (espacio_id, sentido, importe, categoria_id, frecuencia, desde, hasta)
  values ((select esp_a from ref), 'salida', 100, (select cat_a from ref), 'mensual', '2026-05-01', '2026-04-01')
$$, '23514', null, '«hasta» no puede ser anterior a «desde»');

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);

select is((select count(*)::int from public.recurrencias), 0, 'B no ve las recurrencias de A');
select results_eq(
  $$ with x as (delete from public.recurrencias returning 1) select count(*)::int from x $$,
  array[0], 'B no puede borrar las recurrencias de A');
select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, recurrencia_id, ocurrencia)
  values ((select esp_b from ref), '2026-02-01', 1299, 'salida', (select cat_b from ref), (select rec_a from ref), '2026-02-01')
$$, '23503', null, 'B no puede enlazar un movimiento suyo a una recurrencia de A');

-- Borrar la recurrencia conserva los movimientos ya confirmados
reset role;
delete from public.recurrencias;
select results_eq(
  $$ select importe, recurrencia_id is null, ocurrencia::text from public.movimientos $$,
  $$ values (1399::bigint, true, '2026-02-01') $$,
  'al borrar la recurrencia, el movimiento confirmado se conserva');

select * from finish();
rollback;
