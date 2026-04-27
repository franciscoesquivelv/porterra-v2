-- ─────────────────────────────────────────────────────────────────────────────
-- PORTERRA V2 — Migration 008: Powerloop Foundation
--
-- Agrega la infraestructura de datos necesaria para el matching de cargas
-- de retorno (powerloop inspirado en Uber). No implementa el algoritmo —
-- solo establece las bases para que Fase 2 pueda activarlo sin reconstruir.
--
-- Qué agrega:
--   1. carrier_profiles.last_known_country — posición del carrier al terminar
--      un viaje. Permite la query "¿qué cargas hay disponibles desde donde estoy?"
--   2. carrier_profiles.last_delivery_at — timestamp de la última entrega.
--      Permite filtrar carriers que están disponibles ahora vs. los que llevan
--      semanas inactivos.
--   3. idx_transactions_origin_status — índice compuesto para la query de
--      powerloop: "loads disponibles desde país X, ordenados por pickup_date".
--   4. Trigger: update_carrier_location — actualiza last_known_country y
--      last_delivery_at automáticamente en cada evento 'delivered'.
--
-- Query de powerloop (Fase 2, no activada todavía):
--   SELECT t.* FROM transactions t
--   WHERE t.origin_country = (
--     SELECT last_known_country FROM carrier_profiles WHERE user_id = $carrier_id
--   )
--   AND t.status = 'published'
--   ORDER BY t.pickup_date ASC;
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extender carrier_profiles con posición del carrier ─────────────────────

ALTER TABLE public.carrier_profiles
  ADD COLUMN IF NOT EXISTS last_known_country  country_code,
  ADD COLUMN IF NOT EXISTS last_delivery_at    timestamptz;

COMMENT ON COLUMN public.carrier_profiles.last_known_country IS
  'País donde el carrier terminó su último viaje. Base para sugerencias de carga de retorno (powerloop).';

COMMENT ON COLUMN public.carrier_profiles.last_delivery_at IS
  'Timestamp del último evento delivered. Permite filtrar carriers activos.';

-- ── 2. Índice para queries de powerloop eficientes ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transactions_origin_status
  ON public.transactions (origin_country, status, pickup_date ASC);

COMMENT ON INDEX idx_transactions_origin_status IS
  'Soporta la query de powerloop: loads disponibles desde un país específico, ordenados por fecha de recogida.';

-- ── 3. Función: actualizar posición del carrier en eventos delivered ──────────

CREATE OR REPLACE FUNCTION update_carrier_location()
RETURNS TRIGGER AS $$
DECLARE
  carrier_uid      uuid;
  delivery_country country_code;
BEGIN
  -- Solo actúa en eventos de tipo 'delivered'
  IF NEW.event_type != 'delivered' THEN RETURN NEW; END IF;

  -- Obtener carrier_user_id y destination_country de la transacción
  SELECT carrier_user_id, destination_country
  INTO carrier_uid, delivery_country
  FROM public.transactions
  WHERE id = NEW.transaction_id;

  IF carrier_uid IS NULL THEN RETURN NEW; END IF;

  -- Actualizar posición conocida del carrier
  UPDATE public.carrier_profiles
  SET
    last_known_country = delivery_country,
    last_delivery_at   = NEW.created_at
  WHERE user_id = carrier_uid;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 4. Trigger en tracking_events ─────────────────────────────────────────────

DROP TRIGGER IF EXISTS tracking_update_carrier_location ON public.tracking_events;

CREATE TRIGGER tracking_update_carrier_location
  AFTER INSERT ON public.tracking_events
  FOR EACH ROW
  WHEN (NEW.event_type = 'delivered')
  EXECUTE FUNCTION update_carrier_location();
