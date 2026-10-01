-- 001 · Espacios y miembros (SPEC §4, §8.2)
-- Cada dato de gastos cuelga de un espacio; la RLS se basa en ser miembro del espacio.

----------------------------------------------------------------------------
-- Endurecimiento general
----------------------------------------------------------------------------

-- Esquema privado: NO se expone por la API (config.toml: schemas = ["public"])
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

-- Nada de lo que se cree en public queda abierto por defecto a anon (SPEC S7)
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
alter default privileges in schema privado revoke execute on functions from anon, public;

-- RLS automática en cualquier tabla nueva de public (plantilla de la documentación de Supabase)
create or replace function privado.activar_rls_automatica()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
      and schema_name = 'public'
  loop
    execute format('alter table if exists %s enable row level security', cmd.object_identity);
  end loop;
end;
$$;

drop event trigger if exists asegurar_rls;
create event trigger asegurar_rls on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function privado.activar_rls_automatica();

----------------------------------------------------------------------------
-- Funciones auxiliares
----------------------------------------------------------------------------

-- Auditoría fijada por el servidor: el cliente no puede falsear quién creó o modificó (SPEC CA6.6)
create or replace function privado.fijar_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_en := now();
    new.creado_por := coalesce(auth.uid(), new.creado_por);
  else
    new.creado_en := old.creado_en;
    new.creado_por := old.creado_por;
  end if;
  new.actualizado_en := now();
  new.actualizado_por := coalesce(auth.uid(), new.actualizado_por);
  return new;
end;
$$;

----------------------------------------------------------------------------
-- Tablas
----------------------------------------------------------------------------

create type public.tipo_espacio as enum ('individual', 'compartido');

create table public.espacios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 60),
  tipo public.tipo_espacio not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users on delete set null,
  actualizado_por uuid references auth.users on delete set null
);

create table public.miembros (
  espacio_id uuid not null references public.espacios on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  -- Reparto por defecto del espacio (SPEC §4.6); la suma por espacio se valida en T14
  porcentaje_defecto numeric(5, 2) not null default 50
    check (porcentaje_defecto > 0 and porcentaje_defecto <= 100),
  creado_en timestamptz not null default now(),
  primary key (espacio_id, user_id)
);

create index miembros_user_id_idx on public.miembros (user_id);

create trigger auditoria before insert or update on public.espacios
  for each row execute function privado.fijar_auditoria();

----------------------------------------------------------------------------
-- Pertenencia y MFA (usadas por todas las políticas)
----------------------------------------------------------------------------

-- security definer: consulta miembros sin pasar por su propia RLS (evita recursión)
create or replace function privado.es_miembro(p_espacio uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros m
    where m.espacio_id = p_espacio and m.user_id = (select auth.uid())
  );
$$;

-- MFA opcional (SPEC S9): si el usuario tiene un factor verificado, se exige aal2
create or replace function privado.cumple_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from auth.mfa_factors f
      where f.user_id = (select auth.uid()) and f.status = 'verified'
    ) then coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    else true
  end;
$$;

revoke all on function privado.es_miembro(uuid) from public, anon;
revoke all on function privado.cumple_mfa() from public, anon;
grant execute on function privado.es_miembro(uuid) to authenticated;
grant execute on function privado.cumple_mfa() to authenticated;

----------------------------------------------------------------------------
-- Permisos y RLS
----------------------------------------------------------------------------

alter table public.espacios enable row level security;
alter table public.miembros enable row level security;

revoke all on public.espacios, public.miembros from anon, authenticated;
-- Crear espacios y miembros solo mediante funciones del servidor (T13); el cliente
-- solo puede leer y renombrar. El tipo de espacio no se puede cambiar.
grant select on public.espacios, public.miembros to authenticated;
grant update (nombre) on public.espacios to authenticated;

create policy espacios_select on public.espacios for select to authenticated
  using ((select privado.es_miembro(id)));

create policy espacios_update on public.espacios for update to authenticated
  using ((select privado.es_miembro(id)))
  with check ((select privado.es_miembro(id)));

create policy miembros_select on public.miembros for select to authenticated
  using ((select privado.es_miembro(espacio_id)));

create policy espacios_mfa on public.espacios as restrictive to authenticated
  using ((select privado.cumple_mfa()));

create policy miembros_mfa on public.miembros as restrictive to authenticated
  using ((select privado.cumple_mfa()));

----------------------------------------------------------------------------
-- Espacio individual automático al dar de alta un usuario
----------------------------------------------------------------------------

create or replace function privado.crear_espacio_individual()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_espacio uuid;
begin
  insert into public.espacios (nombre, tipo, creado_por, actualizado_por)
  values ('Yo', 'individual', new.id, new.id)
  returning id into v_espacio;

  insert into public.miembros (espacio_id, user_id, porcentaje_defecto)
  values (v_espacio, new.id, 100);

  return new;
end;
$$;

revoke all on function privado.crear_espacio_individual() from public, anon, authenticated;

create trigger crear_espacio_individual after insert on auth.users
  for each row execute function privado.crear_espacio_individual();
