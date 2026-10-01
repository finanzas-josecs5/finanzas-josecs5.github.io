-- Tests de RLS de espacios y miembros (SPEC CA1.4, CA2.1, CA2.2, CA2.4)
-- A y B son usuarios de prueba; nada de esto toca datos reales.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Usuarios de prueba con UUID fijos
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@prueba.local', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@prueba.local', now(), now());

-- Espacio individual de A, guardado para referirse a él siendo otro usuario
create temp table esp_a on commit drop as
  select m.espacio_id as id from public.miembros m
  where m.user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
grant select on esp_a to authenticated, anon;

----------------------------------------------------------------------------
-- Como administrador (postgres)
----------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.espacios'::regclass), 'RLS activa en espacios');
select ok((select relrowsecurity from pg_class where oid = 'public.miembros'::regclass), 'RLS activa en miembros');

select results_eq(
  $$ select e.tipo::text, e.nombre, m.porcentaje_defecto::int
     from public.espacios e join public.miembros m on m.espacio_id = e.id
     where m.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ values ('individual', 'Yo', 100) $$,
  'al dar de alta un usuario se crea su espacio individual «Yo» al 100 %'
);

create table public.tabla_nueva_prueba (id int);
select ok((select relrowsecurity from pg_class where oid = 'public.tabla_nueva_prueba'::regclass),
  'una tabla nueva en public nace con RLS activada');
drop table public.tabla_nueva_prueba;

----------------------------------------------------------------------------
-- Como A (sin MFA, aal1)
----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select is((select count(*)::int from public.espacios), 1, 'A ve su espacio');
select is((select count(*)::int from public.miembros), 1, 'A ve su pertenencia');

select throws_ok($$ update public.espacios set tipo = 'compartido' $$, '42501', null,
  'A no puede cambiar el tipo de su espacio');
select throws_ok($$ insert into public.espacios (nombre, tipo) values ('Otro', 'compartido') $$, '42501', null,
  'A no puede crear espacios directamente (solo mediante funciones del servidor)');

update public.espacios set nombre = 'Mis cosas' where id = (select id from esp_a);
select results_eq(
  $$ select nombre, actualizado_por::text, creado_por::text from public.espacios $$,
  $$ values ('Mis cosas', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  'A puede renombrar su espacio y la auditoría la fija el servidor'
);

----------------------------------------------------------------------------
-- Como B: no debe ver ni tocar nada de A (CA2.1, CA2.2)
----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);

select is((select count(*)::int from public.espacios where id = (select id from esp_a)), 0,
  'B no ve el espacio individual de A');
select is((select count(*)::int from public.miembros where espacio_id = (select id from esp_a)), 0,
  'B no ve los miembros del espacio de A');
select is((select count(*)::int from public.espacios), 1, 'B solo ve su propio espacio');

select results_eq(
  $$ with x as (update public.espacios set nombre = 'hackeado' where id = (select id from esp_a) returning 1)
     select count(*)::int from x $$,
  array[0], 'B no puede renombrar el espacio de A'
);
select throws_ok(
  $$ insert into public.miembros (espacio_id, user_id) values ((select id from esp_a), 'bbbbbbbb-0000-0000-0000-000000000002') $$,
  '42501', null, 'B no puede añadirse al espacio de A'
);
select throws_ok($$ delete from public.espacios where id = (select id from esp_a) $$, '42501', null,
  'B no puede borrar el espacio de A');

----------------------------------------------------------------------------
-- Como anon: ningún acceso (CA2.4)
----------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$ select * from public.espacios $$, '42501', null, 'anon no puede leer espacios');
select throws_ok($$ select * from public.miembros $$, '42501', null, 'anon no puede leer miembros');
select throws_ok($$ select privado.es_miembro((select id from esp_a)) $$, '42501', null,
  'anon no puede usar el esquema privado');

----------------------------------------------------------------------------
-- MFA opcional (CA1.4): con un factor verificado, aal1 no ve nada y aal2 sí
----------------------------------------------------------------------------
reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'móvil', 'totp', 'verified', now(), now(), 'secreto-de-prueba');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::int from public.espacios), 0, 'A con MFA activado y sesión aal1 no ve nada');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from public.espacios), 1, 'A con MFA y sesión aal2 ve su espacio');

reset role;
select * from finish();
rollback;
