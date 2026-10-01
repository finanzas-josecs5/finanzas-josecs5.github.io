-- 004 · Recurrencias (SPEC §4.3, CA4.4)
-- Una recurrencia genera ocurrencias virtuales cada mes; al confirmar o ajustar una se crea
-- un movimiento con recurrencia_id y la fecha prevista (ocurrencia). Ajustar una ocurrencia
-- no cambia las demás.

create type public.frecuencia as enum ('mensual', 'trimestral', 'anual', 'cada_n_meses');

create table public.recurrencias (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios on delete cascade,
  sentido public.sentido not null,
  importe bigint not null check (importe > 0 and importe <= 100000000000),
  categoria_id uuid not null,
  naturaleza public.naturaleza not null default 'fijo',
  concepto text check (char_length(concepto) <= 120),
  comercio text check (char_length(comercio) <= 80),
  pagado_por uuid not null default auth.uid(),
  frecuencia public.frecuencia not null,
  cada_n smallint not null default 1 check (cada_n between 1 and 24),
  desde date not null,
  hasta date check (hasta is null or hasta >= desde),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users on delete set null,
  actualizado_por uuid references auth.users on delete set null,
  unique (espacio_id, id),
  foreign key (espacio_id, sentido, categoria_id) references public.categorias (espacio_id, sentido, id),
  foreign key (espacio_id, pagado_por) references public.miembros (espacio_id, user_id)
);

create trigger auditoria before insert or update on public.recurrencias
  for each row execute function privado.fijar_auditoria();

-- Enlace movimiento → recurrencia (del mismo espacio) y fecha prevista de la ocurrencia
alter table public.movimientos
  add column ocurrencia date,
  add constraint movimientos_recurrencia_fkey foreign key (espacio_id, recurrencia_id)
    references public.recurrencias (espacio_id, id) on delete set null (recurrencia_id),
  -- Un movimiento que viene de una recurrencia siempre dice qué ocurrencia confirma
  -- (si luego se borra la recurrencia, el movimiento se conserva con su fecha prevista)
  add constraint movimientos_ocurrencia_con_recurrencia
    check (recurrencia_id is null or ocurrencia is not null);

-- Cada ocurrencia se confirma una sola vez
create unique index movimientos_una_vez_por_ocurrencia
  on public.movimientos (recurrencia_id, ocurrencia) where recurrencia_id is not null;

----------------------------------------------------------------------------
-- Índices de claves foráneas (aviso de rendimiento de Supabase)
----------------------------------------------------------------------------

create index movimientos_categoria_fk_idx on public.movimientos (espacio_id, sentido, categoria_id);
create index movimientos_pagado_por_idx on public.movimientos (espacio_id, pagado_por);
create index movimientos_recurrencia_idx on public.movimientos (espacio_id, recurrencia_id);
create index comercios_categoria_idx on public.comercios (espacio_id, categoria_id);
create index recurrencias_espacio_idx on public.recurrencias (espacio_id);
create index recurrencias_categoria_idx on public.recurrencias (espacio_id, sentido, categoria_id);
create index recurrencias_pagado_por_idx on public.recurrencias (espacio_id, pagado_por);
drop index if exists public.movimientos_categoria_idx;

----------------------------------------------------------------------------
-- Permisos y RLS
----------------------------------------------------------------------------

alter table public.recurrencias enable row level security;
revoke all on public.recurrencias from anon, authenticated;
grant select, insert, update, delete on public.recurrencias to authenticated;

create policy recurrencias_miembros on public.recurrencias for all to authenticated
  using ((select privado.es_miembro(espacio_id)))
  with check ((select privado.es_miembro(espacio_id)));

create policy recurrencias_mfa on public.recurrencias as restrictive to authenticated
  using ((select privado.cumple_mfa()));
