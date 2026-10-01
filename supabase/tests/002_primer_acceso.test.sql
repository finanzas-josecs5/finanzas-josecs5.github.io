-- La cuenta nueva queda marcada para cambiar la contraseña (SPEC CA1.3)
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@prueba.local', null, now(), now()),
  ('dddddddd-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@prueba.local', '{"nombre":"D"}', now(), now());

select is(
  (select raw_user_meta_data from auth.users where id = 'cccccccc-0000-0000-0000-000000000003'),
  '{"debe_cambiar_contrasena": true}'::jsonb,
  'una cuenta sin metadatos queda marcada'
);
select is(
  (select raw_user_meta_data from auth.users where id = 'dddddddd-0000-0000-0000-000000000004'),
  '{"nombre": "D", "debe_cambiar_contrasena": true}'::jsonb,
  'se conservan los metadatos existentes'
);

select * from finish();
rollback;
