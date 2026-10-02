-- Espacios compartidos (SPEC F2: CA2.2, CA2.3; §10.1: como mucho dos miembros)
-- A crea «Pareja» y «Piso» y añade a B a «Pareja». C no es miembro de nada de eso.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@prueba.local', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@prueba.local', now(), now()),
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@prueba.local', now(), now());

-- Referencias para usarlas siendo cada usuario (las rellena A al crear los espacios)
create temp table ref on commit drop as
  select
    (select espacio_id from public.miembros where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') as esp_a,
    null::uuid as pareja,
    null::uuid as piso,
    null::uuid as cat_pareja;
grant select, update on ref to authenticated, anon;

----------------------------------------------------------------------------
-- A crea dos espacios compartidos
----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select lives_ok($$ update ref set pareja = public.crear_espacio_compartido('  Pareja ') $$,
  'A crea el espacio «Pareja»');
select lives_ok($$ update ref set piso = public.crear_espacio_compartido('Piso') $$,
  'A crea el espacio «Piso»');

select results_eq(
  $$ select nombre, tipo::text, creado_por::text from public.espacios where id = (select pareja from ref) $$,
  $$ values ('Pareja', 'compartido', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  'el espacio nace compartido, con el nombre limpio y la auditoría del servidor'
);
select results_eq(
  $$ select user_id::text, porcentaje_defecto::int from public.miembros where espacio_id = (select pareja from ref) $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001', 100) $$,
  'quien lo crea es su primer miembro, al 100 % mientras esté solo'
);
select is((select count(*)::int from public.categorias where espacio_id = (select pareja from ref)), 13,
  'el espacio compartido recibe las categorías iniciales');
select is((select count(*)::int from public.espacios), 3, 'A ve Yo, Pareja y Piso');

select throws_ok($$ select public.crear_espacio_compartido('   ') $$, '23514', null,
  'no se puede crear un espacio sin nombre');

----------------------------------------------------------------------------
-- A añade a B a «Pareja» (anadir_miembro)
----------------------------------------------------------------------------
select lives_ok($$ select public.anadir_miembro((select pareja from ref), '  B@Prueba.LOCAL ') $$,
  'A añade a B por email, sin importar mayúsculas ni espacios');
select results_eq(
  $$ select user_id::text, porcentaje_defecto::int from public.miembros
     where espacio_id = (select pareja from ref) order by user_id $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001', 50), ('bbbbbbbb-0000-0000-0000-000000000002', 50) $$,
  'con dos miembros, el reparto por defecto pasa a 50/50'
);
select results_eq(
  $$ select user_id::text, email from public.miembros_del_espacio((select pareja from ref)) $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001', 'a@prueba.local'), ('bbbbbbbb-0000-0000-0000-000000000002', 'b@prueba.local') $$,
  'los miembros de un espacio pueden ver el email del otro'
);

select throws_ok($$ select public.anadir_miembro((select pareja from ref), 'b@prueba.local') $$, '23505', null,
  'no se puede añadir dos veces a la misma persona');
select throws_ok($$ select public.anadir_miembro((select pareja from ref), 'c@prueba.local') $$, '54000', null,
  'un espacio compartido tiene como mucho dos miembros');
select throws_ok($$ select public.anadir_miembro((select piso from ref), 'nadie@prueba.local') $$, 'P0002', null,
  'falla si no hay ninguna cuenta con ese email');
select throws_ok($$ select public.anadir_miembro((select esp_a from ref), 'b@prueba.local') $$, '22023', null,
  'el espacio individual «Yo» no se puede compartir');

update ref set cat_pareja = (select id from public.categorias where espacio_id = ref.pareja and nombre = 'Supermercado');
select lives_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, comercio)
  values ((select pareja from ref), '2026-10-02', 3000, 'salida', (select cat_pareja from ref), 'Mercadona')
$$, 'A apunta un gasto en «Pareja»');

----------------------------------------------------------------------------
-- B, ya miembro de «Pareja»
----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);

select is((select count(*)::int from public.espacios), 2, 'B ve su «Yo» y «Pareja», pero no «Piso»');
select is((select count(*)::int from public.movimientos where espacio_id = (select pareja from ref)), 1,
  'B ve el gasto que apuntó A en «Pareja»');
select lives_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id, comercio)
  values ((select pareja from ref), '2026-10-02', 1500, 'salida', (select cat_pareja from ref), 'Panadería')
$$, 'B apunta un gasto en «Pareja»');
select is((select count(*)::int from public.miembros_del_espacio((select piso from ref))), 0,
  'B no ve los miembros de «Piso»');

----------------------------------------------------------------------------
-- C no es miembro: no lee, no escribe y no se puede colar (CA2.2, CA2.3)
----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}', true);

select is((select count(*)::int from public.espacios where id = (select pareja from ref)), 0,
  'C no ve «Pareja»');
select is((select count(*)::int from public.movimientos where espacio_id = (select pareja from ref)), 0,
  'C no ve los gastos de «Pareja»');
select is((select count(*)::int from public.miembros_del_espacio((select pareja from ref))), 0,
  'C no ve los miembros de «Pareja» ni sus emails');
select throws_ok($$
  insert into public.movimientos (espacio_id, fecha, importe, sentido, categoria_id)
  values ((select pareja from ref), '2026-10-02', 100, 'salida', (select cat_pareja from ref))
$$, '42501', null, 'C no puede apuntar gastos en «Pareja»');
select throws_ok(
  $$ insert into public.miembros (espacio_id, user_id) values ((select piso from ref), 'cccccccc-0000-0000-0000-000000000003') $$,
  '42501', null, 'C no puede añadirse a sí mismo a «Piso»');
select throws_ok($$ select public.anadir_miembro((select piso from ref), 'c@prueba.local') $$, '42501', null,
  'C no puede usar anadir_miembro en un espacio del que no es miembro');
select results_eq(
  $$ with x as (update public.espacios set nombre = 'hackeado' where id = (select pareja from ref) returning 1)
     select count(*)::int from x $$,
  array[0], 'C no puede renombrar «Pareja»');

----------------------------------------------------------------------------
-- anon, nada
----------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$ select public.crear_espacio_compartido('Piso') $$, '42501', null,
  'anon no puede crear espacios');
select throws_ok($$ select public.anadir_miembro((select piso from ref), 'a@prueba.local') $$, '42501', null,
  'anon no puede añadir miembros');
select throws_ok($$ select * from public.miembros_del_espacio((select pareja from ref)) $$, '42501', null,
  'anon no puede ver miembros');

----------------------------------------------------------------------------
-- MFA (CA1.4): con un factor verificado y sesión aal1, A no puede crear ni compartir
----------------------------------------------------------------------------
reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'móvil', 'totp', 'verified', now(), now(), 'secreto-de-prueba');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select throws_ok($$ select public.crear_espacio_compartido('Otro') $$, '42501', null,
  'A con MFA y sesión aal1 no puede crear espacios');
select throws_ok($$ select public.anadir_miembro((select piso from ref), 'c@prueba.local') $$, '42501', null,
  'A con MFA y sesión aal1 no puede añadir miembros');
select is((select count(*)::int from public.miembros_del_espacio((select pareja from ref))), 0,
  'A con MFA y sesión aal1 no ve los miembros');

----------------------------------------------------------------------------
-- Comprobación final como administrador
----------------------------------------------------------------------------
reset role;
select results_eq(
  $$ select (select count(*)::int from public.miembros where espacio_id = r.pareja),
            (select count(*)::int from public.miembros where espacio_id = r.piso)
     from ref r $$,
  $$ values (2, 1) $$,
  'nadie se ha colado: «Pareja» tiene 2 miembros y «Piso» 1'
);

select * from finish();
rollback;
