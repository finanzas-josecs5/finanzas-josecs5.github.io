-- «Pagado por» y reparto (SPEC CA6.5, CA6.6, CA6.7)
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@prueba.local', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@prueba.local', now(), now()),
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@prueba.local', now(), now());

create temp table ref (pareja uuid, yo_a uuid, cat_pareja uuid, cat_yo_a uuid, mov uuid) on commit drop;
grant select, insert, update on ref to authenticated;

-- A crea «Pareja» y añade a B
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
insert into ref (pareja) values (public.crear_espacio_compartido('Pareja'));
select public.anadir_miembro((select pareja from ref), 'b@prueba.local');
update ref set
  yo_a = (select e.id from public.espacios e where e.tipo = 'individual'),
  cat_pareja = (select c.id from public.categorias c where c.espacio_id = ref.pareja and c.nombre = 'Restaurantes y ocio');
update ref set cat_yo_a = (select c.id from public.categorias c where c.espacio_id = ref.yo_a and c.nombre = 'Supermercado');

-- Sin reparto explícito se usa el del espacio (50/50)
insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id)
values ((select pareja from ref), '2026-09-05', 1001, 'salida', (select cat_pareja from ref));
update ref set mov = (select id from public.movimientos where espacio_id = ref.pareja);
select is(
  (select reparto from public.movimientos where id = (select mov from ref)),
  '{"aaaaaaaa-0000-0000-0000-000000000001": 50, "bbbbbbbb-0000-0000-0000-000000000002": 50}'::jsonb,
  'sin reparto explícito, el gasto compartido usa el 50/50 del espacio'
);

-- CA6.7: reparto propio de un gasto (70/30) sin cambiar el del espacio
select lives_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, reparto)
  values ((select pareja from ref), '2026-09-06', 10000, 'salida', (select cat_pareja from ref),
          '{"aaaaaaaa-0000-0000-0000-000000000001": 70, "bbbbbbbb-0000-0000-0000-000000000002": 30}')
$$, 'un gasto puede tener su propio reparto 70/30');
select is((select array_agg(porcentaje_defecto::int order by user_id) from public.miembros where espacio_id = (select pareja from ref)),
  array[50, 50], 'el reparto por defecto del espacio no cambia');

-- CA6.5: repartos imposibles
select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, reparto)
  values ((select pareja from ref), '2026-09-06', 100, 'salida', (select cat_pareja from ref),
          '{"aaaaaaaa-0000-0000-0000-000000000001": 70, "bbbbbbbb-0000-0000-0000-000000000002": 20}')
$$, '23514', null, 'un reparto que no suma 100 se rechaza');
select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, reparto)
  values ((select pareja from ref), '2026-09-06', 100, 'salida', (select cat_pareja from ref),
          '{"aaaaaaaa-0000-0000-0000-000000000001": 50, "cccccccc-0000-0000-0000-000000000003": 50}')
$$, '23514', null, 'un reparto con alguien que no es miembro se rechaza');
select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, reparto)
  values ((select pareja from ref), '2026-09-06', 100, 'salida', (select cat_pareja from ref),
          '{"aaaaaaaa-0000-0000-0000-000000000001": "cien"}')
$$, '23514', null, 'los porcentajes deben ser números');
select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, reparto)
  values ((select yo_a from ref), '2026-09-06', 100, 'salida', (select cat_yo_a from ref),
          '{"aaaaaaaa-0000-0000-0000-000000000001": 100}')
$$, '23514', null, 'el espacio «Yo» no admite reparto');
select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, pagado_por)
  values ((select pareja from ref), '2026-09-06', 100, 'salida', (select cat_pareja from ref),
          'cccccccc-0000-0000-0000-000000000003')
$$, '23503', null, 'quien paga tiene que ser miembro (CA6.5)');
select lives_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, pagado_por)
  values ((select pareja from ref), '2026-09-07', 2000, 'salida', (select cat_pareja from ref),
          'bbbbbbbb-0000-0000-0000-000000000002')
$$, 'A puede apuntar un gasto que pagó B');

-- CA6.6: B edita un gasto creado por A; la auditoría la fija el servidor
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
update public.movimientos set importe = 1200 where id = (select mov from ref);
select results_eq(
  $$ select importe, creado_por::text, actualizado_por::text from public.movimientos where id = (select mov from ref) $$,
  $$ values (1200::bigint, 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002') $$,
  'B puede editar un gasto de A y queda como «modificado por» B'
);
select results_eq(
  $$ with x as (delete from public.movimientos where id = (select mov from ref) returning 1) select count(*)::int from x $$,
  array[1], 'B puede borrar un gasto compartido creado por A (P1)');

-- C no es miembro: no ve nada del espacio
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::int from public.movimientos where espacio_id = (select pareja from ref)), 0,
  'quien no es miembro no ve los gastos compartidos');

reset role;
select * from finish();
rollback;
