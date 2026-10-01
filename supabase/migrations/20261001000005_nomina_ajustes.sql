-- 005 · Nómina y ajustes (SPEC F3, §4). Datos estrictamente personales: ni siquiera la
-- pareja los ve. La RLS es por usuario, no por espacio.

create table public.nomina (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  pagas smallint not null check (pagas in (12, 14)),
  neto_ordinario bigint not null check (neto_ordinario > 0 and neto_ordinario <= 100000000),
  -- Neto de cada paga extra (puede ser distinto del ordinario); 0 con 12 pagas
  neto_extra bigint not null default 0 check (neto_extra >= 0 and neto_extra <= 100000000),
  meses_extra smallint[] not null default '{6,12}'
    check (cardinality(meses_extra) = 2 and 1 <= all (meses_extra) and 12 >= all (meses_extra)),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users on delete set null,
  actualizado_por uuid references auth.users on delete set null
);

create table public.ajustes (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  minutos_inactividad smallint not null default 30 check (minutos_inactividad between 5 and 240),
  dias_recordatorio smallint not null default 30 check (dias_recordatorio between 7 and 365),
  -- Parámetros del simulador y umbrales de los consejos (se validan en la app)
  simulador jsonb not null default '{}' check (jsonb_typeof(simulador) = 'object'),
  umbrales jsonb not null default '{}' check (jsonb_typeof(umbrales) = 'object'),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users on delete set null,
  actualizado_por uuid references auth.users on delete set null
);

create index nomina_creado_por_idx on public.nomina (creado_por);
create index ajustes_creado_por_idx on public.ajustes (creado_por);

create trigger auditoria before insert or update on public.nomina
  for each row execute function privado.fijar_auditoria();
create trigger auditoria before insert or update on public.ajustes
  for each row execute function privado.fijar_auditoria();

alter table public.nomina enable row level security;
alter table public.ajustes enable row level security;
revoke all on public.nomina, public.ajustes from anon, authenticated;
grant select, insert, update, delete on public.nomina, public.ajustes to authenticated;

create policy nomina_propia on public.nomina for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy ajustes_propios on public.ajustes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy nomina_mfa on public.nomina as restrictive to authenticated
  using ((select privado.cumple_mfa()));
create policy ajustes_mfa on public.ajustes as restrictive to authenticated
  using ((select privado.cumple_mfa()));
