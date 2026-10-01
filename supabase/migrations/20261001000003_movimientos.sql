-- 003 · Categorías, movimientos y «comercio → categoría» (SPEC §4, F4)
-- Todo cuelga de un espacio y se protege con es_miembro(). Las claves foráneas compuestas
-- impiden por diseño apuntar a filas de otro espacio (las FK no pasan por la RLS).

create type public.sentido as enum ('entrada', 'salida');
create type public.naturaleza as enum ('fijo', 'variable');
create type public.origen_movimiento as enum ('manual', 'ocr');

----------------------------------------------------------------------------
-- Categorías
----------------------------------------------------------------------------

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 40),
  sentido public.sentido not null,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users on delete set null,
  actualizado_por uuid references auth.users on delete set null,
  unique (espacio_id, sentido, id),
  unique (espacio_id, id),
  unique (espacio_id, sentido, nombre)
);

create trigger auditoria before insert or update on public.categorias
  for each row execute function privado.fijar_auditoria();

----------------------------------------------------------------------------
-- Movimientos (ingresos y gastos)
----------------------------------------------------------------------------

create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios on delete cascade,
  fecha date not null,
  -- Céntimos enteros (SPEC §4.1); tope de 1.000 millones de euros como sanidad
  importe bigint not null check (importe > 0 and importe <= 100000000000),
  sentido public.sentido not null,
  categoria_id uuid not null,
  naturaleza public.naturaleza not null default 'variable',
  concepto text check (char_length(concepto) <= 120),
  comercio text check (char_length(comercio) <= 80),
  pagado_por uuid not null default auth.uid(),
  origen public.origen_movimiento not null default 'manual',
  recurrencia_id uuid,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users on delete set null,
  actualizado_por uuid references auth.users on delete set null,
  -- La categoría es del mismo espacio y del mismo sentido (no se usa «Nómina» en un gasto)
  foreign key (espacio_id, sentido, categoria_id) references public.categorias (espacio_id, sentido, id),
  -- Quien paga es miembro del espacio (SPEC CA6.5)
  foreign key (espacio_id, pagado_por) references public.miembros (espacio_id, user_id)
);

create index movimientos_espacio_fecha_idx on public.movimientos (espacio_id, fecha desc);
create index movimientos_categoria_idx on public.movimientos (categoria_id);

create trigger auditoria before insert or update on public.movimientos
  for each row execute function privado.fijar_auditoria();

----------------------------------------------------------------------------
-- «Comercio → categoría» (SPEC CA4.3): la última categoría usada con cada comercio
----------------------------------------------------------------------------

create table public.comercios (
  espacio_id uuid not null references public.espacios on delete cascade,
  nombre_normalizado text not null check (char_length(nombre_normalizado) between 1 and 80),
  categoria_id uuid not null,
  actualizado_en timestamptz not null default now(),
  primary key (espacio_id, nombre_normalizado),
  foreign key (espacio_id, categoria_id) references public.categorias (espacio_id, id) on delete cascade
);

----------------------------------------------------------------------------
-- Permisos y RLS
----------------------------------------------------------------------------

alter table public.categorias enable row level security;
alter table public.movimientos enable row level security;
alter table public.comercios enable row level security;

revoke all on public.categorias, public.movimientos, public.comercios from anon, authenticated;
grant select, insert, update, delete on public.categorias, public.movimientos, public.comercios to authenticated;

create policy categorias_miembros on public.categorias for all to authenticated
  using ((select privado.es_miembro(espacio_id)))
  with check ((select privado.es_miembro(espacio_id)));

create policy movimientos_miembros on public.movimientos for all to authenticated
  using ((select privado.es_miembro(espacio_id)))
  with check ((select privado.es_miembro(espacio_id)));

create policy comercios_miembros on public.comercios for all to authenticated
  using ((select privado.es_miembro(espacio_id)))
  with check ((select privado.es_miembro(espacio_id)));

create policy categorias_mfa on public.categorias as restrictive to authenticated
  using ((select privado.cumple_mfa()));
create policy movimientos_mfa on public.movimientos as restrictive to authenticated
  using ((select privado.cumple_mfa()));
create policy comercios_mfa on public.comercios as restrictive to authenticated
  using ((select privado.cumple_mfa()));

----------------------------------------------------------------------------
-- Categorías iniciales en cada espacio nuevo (SPEC §4.3, editables)
----------------------------------------------------------------------------

create or replace function privado.sembrar_categorias(p_espacio uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categorias (espacio_id, nombre, sentido, orden)
  select p_espacio, c.nombre, c.sentido::public.sentido, c.orden
  from (values
    ('Vivienda', 'salida', 1),
    ('Suministros', 'salida', 2),
    ('Supermercado', 'salida', 3),
    ('Restaurantes y ocio', 'salida', 4),
    ('Transporte', 'salida', 5),
    ('Salud', 'salida', 6),
    ('Suscripciones', 'salida', 7),
    ('Ropa', 'salida', 8),
    ('Viajes', 'salida', 9),
    ('Regalos', 'salida', 10),
    ('Otros', 'salida', 11),
    ('Nómina', 'entrada', 1),
    ('Otros ingresos', 'entrada', 2)
  ) as c (nombre, sentido, orden)
  on conflict (espacio_id, sentido, nombre) do nothing;
$$;

create or replace function privado.sembrar_categorias_espacio_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privado.sembrar_categorias(new.id);
  return new;
end;
$$;

revoke all on function privado.sembrar_categorias(uuid) from public, anon, authenticated;
revoke all on function privado.sembrar_categorias_espacio_nuevo() from public, anon, authenticated;

create trigger sembrar_categorias after insert on public.espacios
  for each row execute function privado.sembrar_categorias_espacio_nuevo();

-- Espacios que ya existían antes de esta migración
select privado.sembrar_categorias(id) from public.espacios;
