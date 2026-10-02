-- Liquidaciones: solo entre miembros y solo visibles para ellos (SPEC CA6.2, CA2.2)
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@prueba.local', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@prueba.local', now(), now()),
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@prueba.local', now(), now());

create temp table ref (pareja uuid, yo_a uuid) on commit drop;
grant select, insert, update on ref to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
insert into ref (pareja) values (public.crear_espacio_compartido('Pareja'));
select public.anadir_miembro((select pareja from ref), 'b@prueba.local');
update ref set yo_a = (select id from public.espacios where tipo = 'individual');

select ok((select relrowsecurity from pg_class where oid = 'public.liquidaciones'::regclass), 'RLS activa en liquidaciones');

-- B le paga 35,00 € a A
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
select lives_ok($$
  insert into public.liquidaciones (espacio_id, de_user, a_user, importe)
  values ((select pareja from ref), 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 3500)
$$, 'un miembro registra que le pagó al otro');

select throws_ok($$
  insert into public.liquidaciones (espacio_id, de_user, a_user, importe)
  values ((select pareja from ref), 'bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 100)
$$, '23514', null, 'nadie se paga a sí mismo');
select throws_ok($$
  insert into public.liquidaciones (espacio_id, de_user, a_user, importe)
  values ((select pareja from ref), 'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003', 100)
$$, '23503', null, 'solo entre miembros del espacio');
select throws_ok($$
  insert into public.liquidaciones (espacio_id, de_user, a_user, importe)
  values ((select pareja from ref), 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 0)
$$, '23514', null, 'el importe debe ser mayor que cero');

-- A ve la liquidación; C (que no es miembro) no ve ni puede apuntar nada
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select is((select importe from public.liquidaciones), 3500::bigint, 'el otro miembro ve la liquidación');

select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::int from public.liquidaciones), 0, 'quien no es miembro no ve las liquidaciones');
select throws_ok($$
  insert into public.liquidaciones (espacio_id, de_user, a_user, importe)
  values ((select pareja from ref), 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 100)
$$, '42501', null, 'quien no es miembro no puede apuntar liquidaciones');

reset role;
select * from finish();
rollback;
