-- 008 · Liquidaciones de los espacios compartidos (SPEC §4.6, CA6.2, CA6.4)
-- «Saldar» no mueve dinero: apunta que una persona le pagó a la otra para dejar el saldo a cero.

create table public.liquidaciones (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios on delete cascade,
  de_user uuid not null,
  a_user uuid not null,
  importe bigint not null check (importe > 0 and importe <= 100000000000),
  fecha date not null default current_date,
  nota text check (char_length(nota) <= 120),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references auth.users on delete set null,
  actualizado_por uuid references auth.users on delete set null,
  check (de_user <> a_user),
  -- Las dos personas son miembros del espacio (en «Yo» es imposible: solo hay uno)
  foreign key (espacio_id, de_user) references public.miembros (espacio_id, user_id),
  foreign key (espacio_id, a_user) references public.miembros (espacio_id, user_id)
);

create index liquidaciones_espacio_idx on public.liquidaciones (espacio_id, fecha desc);
create index liquidaciones_de_idx on public.liquidaciones (espacio_id, de_user);
create index liquidaciones_a_idx on public.liquidaciones (espacio_id, a_user);

create trigger auditoria before insert or update on public.liquidaciones
  for each row execute function privado.fijar_auditoria();

alter table public.liquidaciones enable row level security;
revoke all on public.liquidaciones from anon, authenticated;
grant select, insert, update, delete on public.liquidaciones to authenticated;

create policy liquidaciones_miembros on public.liquidaciones for all to authenticated
  using ((select privado.es_miembro(espacio_id)))
  with check ((select privado.es_miembro(espacio_id)));

create policy liquidaciones_mfa on public.liquidaciones as restrictive to authenticated
  using ((select privado.cumple_mfa()));
