-- RLS e integridad de categorías, movimientos y comercios (SPEC F4, CA2.1, CA6.5)
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@prueba.local', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@prueba.local', now(), now());

create temp table ref on commit drop as
select
  (select espacio_id from public.miembros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') as esp_a,
  (select espacio_id from public.miembros where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') as esp_b;
alter table ref add column cat_super_a uuid, add column cat_nomina_a uuid, add column cat_super_b uuid;
update ref set
  cat_super_a = (select id from public.categorias where espacio_id = ref.esp_a and nombre = 'Supermercado'),
  cat_nomina_a = (select id from public.categorias where espacio_id = ref.esp_a and nombre = 'Nómina'),
  cat_super_b = (select id from public.categorias where espacio_id = ref.esp_b and nombre = 'Supermercado');
grant select on ref to authenticated, anon;

select is((select count(*)::int from public.categorias where espacio_id = (select esp_a from ref)), 13,
  'cada espacio nuevo recibe las 13 categorías iniciales');
select is((select count(*)::int from public.categorias where espacio_id = (select esp_a from ref) and sentido = 'entrada'), 2,
  'de ellas, 2 de ingresos');
select ok((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.categorias'::regclass, 'public.movimientos'::regclass, 'public.comercios'::regclass)),
  'RLS activa en las tres tablas');

----------------------------------------------------------------------------
-- A trabaja en su espacio
----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select lives_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, comercio, creado_por)
  values ((select esp_a from ref), '2026-09-05', 2345, 'salida', (select cat_super_a from ref), 'Mercadona',
          'bbbbbbbb-0000-0000-0000-000000000002')
$$, 'A puede apuntar un gasto en su espacio');

select results_eq(
  $$ select pagado_por::text, creado_por::text from public.movimientos $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  'pagado_por es A por defecto y la auditoría ignora lo que envía el cliente'
);

select lives_ok($$
  insert into public.comercios (espacio_id, nombre_normalizado, categoria_id)
  values ((select esp_a from ref), 'mercadona', (select cat_super_a from ref))
$$, 'A recuerda «mercadona → Supermercado»');

select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id)
  values ((select esp_a from ref), '2026-09-05', 100, 'salida', (select cat_nomina_a from ref))
$$, '23503', null, 'no se puede usar una categoría de ingresos en un gasto');

select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id)
  values ((select esp_a from ref), '2026-09-05', 0, 'salida', (select cat_super_a from ref))
$$, '23514', null, 'el importe debe ser mayor que cero');

select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, pagado_por)
  values ((select esp_a from ref), '2026-09-05', 100, 'salida', (select cat_super_a from ref),
          'bbbbbbbb-0000-0000-0000-000000000002')
$$, '23503', null, 'quien paga tiene que ser miembro del espacio');

----------------------------------------------------------------------------
-- B no ve ni toca nada de A (CA2.1)
----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);

select is((select count(*)::int from public.movimientos), 0, 'B no ve los movimientos de A');
select is((select count(*)::int from public.categorias where espacio_id = (select esp_a from ref)), 0,
  'B no ve las categorías de A');
select is((select count(*)::int from public.comercios), 0, 'B no ve los comercios de A');

select results_eq(
  $$ with x as (update public.movimientos set importe = 1 returning 1) select count(*)::int from x $$,
  array[0], 'B no puede modificar los movimientos de A');
select results_eq(
  $$ with x as (delete from public.movimientos returning 1) select count(*)::int from x $$,
  array[0], 'B no puede borrar los movimientos de A');
select results_eq(
  $$ with x as (delete from public.categorias where espacio_id = (select esp_a from ref) returning 1) select count(*)::int from x $$,
  array[0], 'B no puede borrar las categorías de A');

select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id)
  values ((select esp_a from ref), '2026-09-05', 100, 'salida', (select cat_super_a from ref))
$$, '42501', null, 'B no puede apuntar gastos en el espacio de A');

select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id)
  values ((select esp_b from ref), '2026-09-05', 100, 'salida', (select cat_super_a from ref))
$$, '23503', null, 'B no puede usar en su espacio una categoría de A');

select throws_ok($$
  update public.categorias set espacio_id = (select esp_a from ref) where id = (select cat_super_b from ref)
$$, '42501', null, 'B no puede mover su categoría al espacio de A');

select throws_ok($$
  insert into public.comercios (espacio_id, nombre_normalizado, categoria_id)
  values ((select esp_a from ref), 'lidl', (select cat_super_a from ref))
$$, '42501', null, 'B no puede escribir en los comercios de A');

----------------------------------------------------------------------------
-- anon, nada
----------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.movimientos $$, '42501', null, 'anon no puede leer movimientos');

reset role;
select is((select importe from public.movimientos), 2345::bigint, 'el gasto de A sigue intacto');

select * from finish();
rollback;
