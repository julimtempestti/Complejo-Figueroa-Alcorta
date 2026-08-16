-- =============================================================
-- F-04 y F-14: seguridad de escritura sobre datos financieros
-- =============================================================
-- Ejecutar en: Supabase Dashboard > SQL Editor. Es idempotente (se puede
-- re-ejecutar). Objetivo:
--   F-04: is_admin() debe reconocer al admin SOLO por la tabla `administradores`
--         (o el super admin). Antes, por descarte, un propietario o una cuenta
--         "sin perfil" pasaba como admin a nivel base de datos.
--   F-14: solo el admin puede insertar/editar/borrar pagos. Los residentes
--         informan por la tabla `transferencias`, no cargan pagos directo.
-- =============================================================

-- 1) is_admin(): admin explícito por email ---------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'marcoluisvallebella@gmail.com'
    or exists (
      select 1
      from public.administradores a
      where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

-- 2) Aseguramos que el admin del consorcio quede registrado (sin romper si la
--    tabla tiene otras columnas obligatorias: si falla, el super admin igual
--    puede agregarlo después desde el módulo Usuarios).
do $$
begin
  if not exists (
    select 1 from public.administradores
    where lower(email) = lower('admconsorcioalcorta@gmail.com')
  ) then
    insert into public.administradores (email) values ('admconsorcioalcorta@gmail.com');
  end if;
exception when others then
  raise notice 'No se pudo autoinsertar admconsorcioalcorta@gmail.com: %', sqlerrm;
end $$;

-- 3) PAGOS: rehacemos TODAS las políticas a un estado correcto conocido.
--    (Borramos cualquier política existente, tenga el nombre que tenga, para no
--    dejar una política vieja y permisiva que deje insertar pagos a residentes.)
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'pagos'
  loop
    execute format('drop policy if exists %I on public.pagos', pol.policyname);
  end loop;
end $$;

create policy "lectura_pagos" on public.pagos
  for select to authenticated using (true);

create policy "admin_inserta_pagos" on public.pagos
  for insert to authenticated with check (public.is_admin());

create policy "admin_actualiza_pagos" on public.pagos
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin_borra_pagos" on public.pagos
  for delete to authenticated using (public.is_admin());

-- 4) MESES: solo el admin escribe; todos los autenticados leen.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'meses'
  loop
    execute format('drop policy if exists %I on public.meses', pol.policyname);
  end loop;
end $$;

create policy "lectura_meses" on public.meses
  for select to authenticated using (true);

create policy "admin_modifica_meses" on public.meses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =============================================================
-- Verificación sugerida (después de correr):
--   - Entrá como admin: debés poder registrar/editar pagos y montos.
--   - Entrá como propietario o residente: NO debés poder escribir pagos ni
--     meses por API (solo lectura). El aviso de transferencia sigue funcionando
--     porque usa la tabla `transferencias`, no `pagos`.
-- =============================================================
