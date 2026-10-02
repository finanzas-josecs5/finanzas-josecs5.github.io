-- 009 · Cartera de fondos indexados (SPEC §4.8, F8). Datos estrictamente personales:
-- la RLS es por usuario y ni siquiera la pareja los ve (CA2.1).

create table public.fondos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  -- Formato ISIN; el dígito de control se valida en la app (src/cartera/isin.ts)
  isin text not null check (isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  -- TER en % anual (0,12 = 0,12 %): informativo, ya está descontado del valor liquidativo
  ter numeric(5, 3) not null default 0 check (ter >= 0 and ter <= 5),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users on delete set null,
  actualizado_por uuid references auth.users on delete set null,
  unique (user_id, id),
  unique (user_id, isin)
);

create table public.aportaciones (
  id uuid primary key default gen_random_uuid(),
  fondo_id uuid not null,
  user_id uuid not null default auth.uid(),
  fecha date not null,
  importe bigint not null check (importe > 0 and importe <= 100000000000),
  participaciones numeric(20, 6) check (participaciones is null or participaciones > 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users on delete set null,
  actualizado_por uuid references auth.users on delete set null,
  -- El fondo es del mismo usuario (las FK no pasan por la RLS)
  foreign key (user_id, fondo_id) references public.fondos (user_id, id) on delete cascade
);

create table public.valoraciones (
  id uuid primary key default gen_random_uuid(),
  fondo_id uuid not null,
  user_id uuid not null default auth.uid(),
  fecha date not null,
  -- Valor total de la posición ese día, en céntimos
  valor bigint not null check (valor >= 0 and valor <= 100000000000),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users on delete set null,
  actualizado_por uuid references auth.users on delete set null,
  unique (fondo_id, fecha),
  foreign key (user_id, fondo_id) references public.fondos (user_id, id) on delete cascade
);

create index aportaciones_fondo_idx on public.aportaciones (user_id, fondo_id, fecha);
create index valoraciones_fondo_idx on public.valoraciones (user_id, fondo_id, fecha);
create index fondos_creado_por_idx on public.fondos (creado_por);
create index aportaciones_creado_por_idx on public.aportaciones (creado_por);
create index valoraciones_creado_por_idx on public.valoraciones (creado_por);

create trigger auditoria before insert or update on public.fondos
  for each row execute function privado.fijar_auditoria();
create trigger auditoria before insert or update on public.aportaciones
  for each row execute function privado.fijar_auditoria();
create trigger auditoria before insert or update on public.valoraciones
  for each row execute function privado.fijar_auditoria();

alter table public.fondos enable row level security;
alter table public.aportaciones enable row level security;
alter table public.valoraciones enable row level security;
revoke all on public.fondos, public.aportaciones, public.valoraciones from anon, authenticated;
grant select, insert, update, delete on public.fondos, public.aportaciones, public.valoraciones to authenticated;

create policy fondos_propios on public.fondos for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy aportaciones_propias on public.aportaciones for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy valoraciones_propias on public.valoraciones for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy fondos_mfa on public.fondos as restrictive to authenticated using ((select privado.cumple_mfa()));
create policy aportaciones_mfa on public.aportaciones as restrictive to authenticated using ((select privado.cumple_mfa()));
create policy valoraciones_mfa on public.valoraciones as restrictive to authenticated using ((select privado.cumple_mfa()));
