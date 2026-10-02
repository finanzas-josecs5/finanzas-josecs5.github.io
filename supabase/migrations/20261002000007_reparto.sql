-- 007 · «Pagado por» y reparto de los gastos compartidos (SPEC §4.6, CA6.1, CA6.5, CA6.7)
-- Cada movimiento de un espacio compartido guarda el porcentaje de cada miembro en
-- `reparto` ({"<user_id>": 50, …}). Las partes en céntimos se calculan con una única regla
-- (src/comun/reparto.ts): quien no pagó paga floor(importe × %), quien pagó el resto.
-- Decisión 2026-10-02: porcentajes en el propio movimiento en lugar de una tabla `repartos`,
-- porque la API no permite insertar movimiento y partes en una misma transacción.

alter table public.movimientos add column reparto jsonb;

-- Gastos compartidos que ya existían: el reparto por defecto de su espacio
update public.movimientos m
set reparto = (
  select jsonb_object_agg(mi.user_id::text, mi.porcentaje_defecto)
  from public.miembros mi
  where mi.espacio_id = m.espacio_id
)
from public.espacios e
where e.id = m.espacio_id and e.tipo = 'compartido' and m.reparto is null;

create or replace function privado.validar_reparto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo public.tipo_espacio;
  v_suma numeric := 0;
  v_par record;
begin
  select e.tipo into v_tipo from public.espacios e where e.id = new.espacio_id;

  if v_tipo = 'individual' then
    if new.reparto is not null then
      raise exception 'El espacio individual no tiene reparto' using errcode = '23514';
    end if;
    return new;
  end if;

  -- Sin reparto explícito, el del espacio (los recurrentes confirmados lo usan)
  if new.reparto is null then
    select jsonb_object_agg(mi.user_id::text, mi.porcentaje_defecto) into new.reparto
    from public.miembros mi where mi.espacio_id = new.espacio_id;
  end if;

  if jsonb_typeof(new.reparto) is distinct from 'object' then
    raise exception 'El reparto debe ser un objeto' using errcode = '23514';
  end if;

  for v_par in select key, value from jsonb_each(new.reparto) loop
    if jsonb_typeof(v_par.value) <> 'number' or (v_par.value)::numeric < 0 or (v_par.value)::numeric > 100 then
      raise exception 'Cada porcentaje debe estar entre 0 y 100' using errcode = '23514';
    end if;
    if v_par.key !~ '^[0-9a-f-]{36}$' or not exists (
      select 1 from public.miembros mi where mi.espacio_id = new.espacio_id and mi.user_id = v_par.key::uuid
    ) then
      raise exception 'El reparto solo puede incluir miembros del espacio' using errcode = '23514';
    end if;
    v_suma := v_suma + (v_par.value)::numeric;
  end loop;

  if v_suma <> 100 then
    raise exception 'El reparto debe sumar 100 %%' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function privado.validar_reparto() from public, anon, authenticated;

create trigger validar_reparto before insert or update of reparto, espacio_id on public.movimientos
  for each row execute function privado.validar_reparto();
