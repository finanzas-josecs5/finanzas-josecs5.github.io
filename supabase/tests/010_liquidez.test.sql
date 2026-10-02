-- La liquidez es estrictamente personal (SPEC CA2.1, P2)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@prueba.local', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@prueba.local', now(), now());

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select lives_ok($$ insert into public.liquidez (fecha, importe) values ('2026-10-01', 1500000) $$, 'A apunta su liquidez');
select throws_ok($$ insert into public.liquidez (fecha, importe) values ('2026-10-01', 1) $$, '23505', null, 'un apunte por día');
select throws_ok($$ insert into public.liquidez (fecha, importe) values ('2026-10-02', -1) $$, '23514', null, 'no puede ser negativa');
select throws_ok($$ insert into public.liquidez (user_id, fecha, importe) values ('bbbbbbbb-0000-0000-0000-000000000002', '2026-10-02', 1) $$,
  '42501', null, 'A no puede apuntar la liquidez de B');

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::int from public.liquidez), 0, 'B no ve la liquidez de A');
select results_eq($$ with x as (delete from public.liquidez returning 1) select count(*)::int from x $$, array[0],
  'B no puede borrar la liquidez de A');

reset role;
select * from finish();
rollback;
