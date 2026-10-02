-- 006 · Espacios compartidos «Pareja» y «Piso» (SPEC F2, CA2.2, CA2.3)
-- El cliente no puede insertar en espacios ni en miembros (001): se crean y se comparten
-- solo con estas funciones. Como mucho dos miembros por espacio (SPEC §10.1).
-- Las funciones security definer viven en el esquema privado (S10); en public solo hay
-- envoltorios security invoker para poder llamarlas como RPC.

----------------------------------------------------------------------------
-- Crear un espacio compartido: quien lo crea es su primer miembro
----------------------------------------------------------------------------

create or replace function privado.crear_espacio_compartido(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_espacio uuid;
begin
  if v_usuario is null or not privado.cumple_mfa() then
    raise exception 'Sin permiso para crear espacios' using errcode = '42501';
  end if;

  -- El nombre lo valida el check de la tabla (1 a 60 caracteres); las categorías
  -- iniciales las siembra el trigger de 003
  insert into public.espacios (nombre, tipo)
  values (btrim(p_nombre), 'compartido')
  returning id into v_espacio;

  -- Mientras esté solo, el reparto por defecto es suyo al 100 %
  insert into public.miembros (espacio_id, user_id, porcentaje_defecto)
  values (v_espacio, v_usuario, 100);

  return v_espacio;
end;
$$;

----------------------------------------------------------------------------
-- Añadir a la otra persona por su email (CA2.3)
----------------------------------------------------------------------------

create or replace function privado.anadir_miembro(p_espacio uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo public.tipo_espacio;
  v_nuevo uuid;
begin
  -- Solo un miembro del espacio, con la MFA al día, puede añadir a alguien
  if not privado.es_miembro(p_espacio) or not privado.cumple_mfa() then
    raise exception 'No eres miembro de este espacio' using errcode = '42501';
  end if;

  -- Se bloquea el espacio para que dos altas simultáneas no pasen de dos miembros
  select e.tipo into v_tipo from public.espacios e where e.id = p_espacio for update;
  if v_tipo is distinct from 'compartido' then
    raise exception 'El espacio individual no se puede compartir' using errcode = '22023';
  end if;

  select u.id into v_nuevo from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_nuevo is null then
    raise exception 'No hay ninguna cuenta con ese email' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.miembros m where m.espacio_id = p_espacio and m.user_id = v_nuevo) then
    raise exception 'Ya es miembro del espacio' using errcode = '23505';
  end if;

  if (select count(*) from public.miembros m where m.espacio_id = p_espacio) >= 2 then
    raise exception 'El espacio ya tiene dos miembros' using errcode = '54000';
  end if;

  -- Con dos miembros, el reparto por defecto es 50/50 (SPEC P3; se edita por gasto en T14)
  insert into public.miembros (espacio_id, user_id, porcentaje_defecto)
  values (p_espacio, v_nuevo, 50);
  update public.miembros m set porcentaje_defecto = 50 where m.espacio_id = p_espacio;
end;
$$;

----------------------------------------------------------------------------
-- Miembros de un espacio con su email (para mostrar «Tú» y la otra persona)
----------------------------------------------------------------------------

create or replace function privado.miembros_del_espacio(p_espacio uuid)
returns table (user_id uuid, email text, porcentaje_defecto numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text, m.porcentaje_defecto
  from public.miembros m
  join auth.users u on u.id = m.user_id
  where m.espacio_id = p_espacio
    and (select privado.es_miembro(p_espacio))
    and (select privado.cumple_mfa())
  order by m.creado_en, m.user_id;
$$;

revoke all on function privado.crear_espacio_compartido(text) from public, anon;
revoke all on function privado.anadir_miembro(uuid, text) from public, anon;
revoke all on function privado.miembros_del_espacio(uuid) from public, anon;
grant execute on function privado.crear_espacio_compartido(text) to authenticated;
grant execute on function privado.anadir_miembro(uuid, text) to authenticated;
grant execute on function privado.miembros_del_espacio(uuid) to authenticated;

----------------------------------------------------------------------------
-- Envoltorios RPC (security invoker): el esquema privado no se expone por la API
----------------------------------------------------------------------------

create or replace function public.crear_espacio_compartido(p_nombre text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select privado.crear_espacio_compartido(p_nombre);
$$;

create or replace function public.anadir_miembro(p_espacio uuid, p_email text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select privado.anadir_miembro(p_espacio, p_email);
$$;

create or replace function public.miembros_del_espacio(p_espacio uuid)
returns table (user_id uuid, email text, porcentaje_defecto numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from privado.miembros_del_espacio(p_espacio);
$$;

revoke all on function public.crear_espacio_compartido(text) from public, anon;
revoke all on function public.anadir_miembro(uuid, text) from public, anon;
revoke all on function public.miembros_del_espacio(uuid) from public, anon;
grant execute on function public.crear_espacio_compartido(text) to authenticated;
grant execute on function public.anadir_miembro(uuid, text) to authenticated;
grant execute on function public.miembros_del_espacio(uuid) to authenticated;
