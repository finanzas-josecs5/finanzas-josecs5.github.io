-- 010 · Liquidez (SPEC §4, P2): saldo total de tus cuentas, apuntado a mano cuando quieras.
-- Lo usan los consejos de colchón y exceso de liquidez (T23). Estrictamente personal.

create table public.liquidez (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  fecha date not null,
  importe bigint not null check (importe >= 0 and importe <= 100000000000),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users on delete set null,
  actualizado_por uuid references auth.users on delete set null,
  -- Un apunte por día: si se vuelve a apuntar el mismo día, se sustituye
  unique (user_id, fecha)
);

create index liquidez_creado_por_idx on public.liquidez (creado_por);

create trigger auditoria before insert or update on public.liquidez
  for each row execute function privado.fijar_auditoria();

alter table public.liquidez enable row level security;
revoke all on public.liquidez from anon, authenticated;
grant select, insert, update, delete on public.liquidez to authenticated;

create policy liquidez_propia on public.liquidez for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy liquidez_mfa on public.liquidez as restrictive to authenticated using ((select privado.cumple_mfa()));
