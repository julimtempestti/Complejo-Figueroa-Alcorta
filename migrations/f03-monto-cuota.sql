-- =============================================================
-- F-03: snapshot de la cuota por pago (congela la deuda histórica)
-- =============================================================
-- Ejecutar en: Supabase Dashboard > SQL Editor.
-- Agrega `monto_cuota` a `pagos`: guarda cuánto era la cuota del mes al momento
-- de registrar el pago. Con esto, editar el monto de un mes ya NO recalcula la
-- deuda de los meses que ya estaban pagados (ver F-03 de la auditoría).
-- Es seguro re-ejecutarlo.
-- =============================================================

alter table public.pagos
  add column if not exists monto_cuota numeric(12, 2);

-- Backfill: para los pagos ya cargados, congelamos la cuota con el monto
-- VIGENTE del mes correspondiente (es la mejor aproximación disponible, ya que
-- no tenemos el historial de cambios de monto). A partir de acá, cada pago
-- nuevo guarda su propio snapshot automáticamente desde la app.
update public.pagos p
set monto_cuota = m.monto_expensa
from public.meses m
where p.mes_id = m.id
  and p.monto_cuota is null;
