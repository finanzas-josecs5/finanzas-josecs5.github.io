-- 002 · Primer acceso (SPEC CA1.3)
-- Las cuentas las crea el administrador con una contraseña temporal; al darlas de alta se
-- marcan para que la app obligue a cambiarla antes de mostrar ningún dato. La marca vive
-- en user_metadata: si un usuario la quitara sin cambiar la contraseña solo se perjudicaría
-- a sí mismo, así que no es un control de seguridad, sino de experiencia.

create or replace function privado.marcar_primer_acceso()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('debe_cambiar_contrasena', true);
  return new;
end;
$$;

revoke all on function privado.marcar_primer_acceso() from public, anon, authenticated;

create trigger marcar_primer_acceso before insert on auth.users
  for each row execute function privado.marcar_primer_acceso();
