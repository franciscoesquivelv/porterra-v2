-- ─────────────────────────────────────────────────────────────────────────────
-- PORTERRA V2 — Migration 004: DUCA-T completo + Tracking de eventos
-- Inspirado en Nuvocargo: tracking granular por cruce fronterizo + DUCA oficial
-- ─────────────────────────────────────────────────────────────────────────────

-- ── TIPOS ENUM ────────────────────────────────────────────────────────────────

CREATE TYPE tracking_event_type AS ENUM (
  'origin_pickup',           -- Carga recogida en origen
  'in_transit',              -- En ruta
  'border_approach',         -- Aproximándose a frontera
  'border_crossing_start',   -- Iniciando trámite fronterizo
  'border_crossing_complete',-- Cruce fronterizo completado
  'customs_cleared',         -- Aduana despachada
  'in_transit_destination',  -- En ruta al destino final
  'delivered',               -- Entregado
  'incident',                -- Incidente reportado
  'delay'                    -- Retraso reportado
);

-- ── DUCA_DOCUMENTS — Formulario DUCA-T completo (SIECA v4.1) ─────────────────
-- El FF llena la DUCA-T. El transportista es auxiliar aduanero autorizado.
-- Campos basados en el Manual del Usuario DUCA-T, Agosto 2022.

CREATE TABLE public.duca_documents (
  id                        uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id            uuid          REFERENCES public.transactions(id) ON DELETE CASCADE,
  ff_user_id                uuid          NOT NULL REFERENCES auth.users(id),
  tipo_duca                 text          NOT NULL DEFAULT 'DUCA-T',
  duca_number               text          UNIQUE,   -- generado al aprobar
  status                    duca_status   NOT NULL DEFAULT 'draft',

  -- ── PASO 1: Ruta ─────────────────────────────────────────────────────────
  pais_procedencia          country_code,
  aduana_inicio             text,
  deposito_origen           text,
  lugar_embarque            text,
  pais_destino              country_code,
  aduana_destino            text,
  deposito_destino          text,
  lugar_desembarque         text,
  observaciones             text,           -- máx 1500 caracteres según SIECA

  -- ── PASO 2: Exportador ───────────────────────────────────────────────────
  exportador_nombre         text,           -- razón social o nombres y apellidos
  exportador_domicilio      text,           -- domicilio fiscal completo
  exportador_tipo_doc       text,           -- NIT, RTN, cédula jurídica, etc.
  exportador_numero_doc     text,
  exportador_pais_emision   text,

  -- ── PASO 3: Importador / Destinatario ────────────────────────────────────
  importador_nombre         text,
  importador_domicilio      text,
  importador_tipo_doc       text,
  importador_numero_doc     text,
  importador_pais_emision   text,

  -- ── PASO 4: Ruta de tránsito ─────────────────────────────────────────────
  -- JSON array de {pais: string, aduana: string}
  -- Ej: [{"pais":"GT","aduana":"La Mesilla"},{"pais":"MX","aduana":"Ciudad Hidalgo"}]
  ruta_transito             jsonb         NOT NULL DEFAULT '[]',

  -- ── PASO 5: Transportista y vehículo ─────────────────────────────────────
  transportista_codigo      text,           -- código en registro SIECA
  transportista_nombre      text,
  transportista_email       text,
  vehiculo_marca            text,
  vehiculo_modelo           text,
  vehiculo_vin              text,           -- número de chasis/VIN
  vehiculo_motor            text,
  vehiculo_pais_registro    text,
  vehiculo_placa            text,

  -- ── PASO 6: Conductor ────────────────────────────────────────────────────
  conductor_primer_nombre   text,
  conductor_segundo_nombre  text,
  conductor_primer_apellido text,
  conductor_segundo_apellido text,
  conductor_tipo_doc        text,
  conductor_numero_doc      text,
  conductor_licencia        text,
  conductor_pais_exp        text,           -- país de expedición del documento

  -- ── PASO 7: Mercancías ───────────────────────────────────────────────────
  -- JSON array de items:
  -- {codigo_sac, descripcion, cantidad_bultos, clase_bultos, pais_origen, marca, peso_bruto_kg}
  mercancias                jsonb         NOT NULL DEFAULT '[]',
  -- Valores totales (sección inferior del paso 7)
  valor_transaccion         numeric(12,2),  -- precio pagado o por pagar
  gastos_transporte         numeric(12,2),  -- flete desde embarque hasta destino
  gastos_seguro             numeric(12,2),
  otros_gastos              numeric(12,2),
  valor_aduana_total        numeric(12,2),  -- base para cálculo de impuestos

  -- ── Meta ─────────────────────────────────────────────────────────────────
  submitted_at              timestamptz,
  approved_at               timestamptz,
  metadata                  jsonb         NOT NULL DEFAULT '{}',
  created_at                timestamptz   NOT NULL DEFAULT now(),
  updated_at                timestamptz   NOT NULL DEFAULT now()
);

CREATE TRIGGER duca_documents_updated_at
  BEFORE UPDATE ON public.duca_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Número DUCA auto-generado al aprobar: DUCA-T-2026-00001
CREATE OR REPLACE FUNCTION generate_duca_number()
RETURNS TRIGGER AS $$
DECLARE
  year_str text := to_char(now(), 'YYYY');
  seq_num  int;
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.duca_number IS NULL THEN
    SELECT COUNT(*) + 1 INTO seq_num
    FROM public.duca_documents
    WHERE to_char(created_at, 'YYYY') = year_str AND status = 'approved';
    NEW.duca_number := 'DUCA-T-' || year_str || '-' || LPAD(seq_num::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER duca_number_trigger
  BEFORE UPDATE ON public.duca_documents
  FOR EACH ROW EXECUTE FUNCTION generate_duca_number();

CREATE INDEX idx_duca_ff_user     ON public.duca_documents(ff_user_id, status, created_at DESC);
CREATE INDEX idx_duca_transaction ON public.duca_documents(transaction_id);

-- ── TRACKING_EVENTS — Seguimiento granular tipo Nuvocargo ────────────────────
-- El carrier actualiza eventos. El FF y admin los ven en tiempo real.
-- Inspirado en: Nuvocargo rastrea 6+ sub-eventos por cruce fronterizo.

CREATE TABLE public.tracking_events (
  id              uuid                  DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id  uuid                  NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  event_type      tracking_event_type   NOT NULL,
  country         country_code,
  location_name   text,                 -- ej: "Aduana La Mesilla", "Bodega Express GT"
  notes           text,
  created_by      uuid                  NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz           NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracking_transaction ON public.tracking_events(transaction_id, created_at DESC);
CREATE INDEX idx_tracking_carrier     ON public.tracking_events(created_by, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.duca_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

-- DUCA: FF ve y edita los suyos, admin ve todo
CREATE POLICY duca_ff_select ON public.duca_documents
  FOR SELECT TO authenticated
  USING (auth.uid() = ff_user_id OR porterra_role() = 'admin');

CREATE POLICY duca_ff_insert ON public.duca_documents
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = ff_user_id AND porterra_role() = 'freight_forwarder');

CREATE POLICY duca_ff_update ON public.duca_documents
  FOR UPDATE TO authenticated
  USING (auth.uid() = ff_user_id AND status IN ('draft', 'submitted'))
  WITH CHECK (auth.uid() = ff_user_id);

CREATE POLICY duca_admin_all ON public.duca_documents
  FOR ALL TO authenticated
  USING (porterra_role() = 'admin');

-- Tracking: carrier puede insertar en sus transacciones, todos los roles ven
CREATE POLICY tracking_carrier_insert ON public.tracking_events
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    porterra_role() = 'carrier' AND
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id AND t.carrier_user_id = auth.uid()
    )
  );

CREATE POLICY tracking_ff_select ON public.tracking_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
        AND (t.ff_user_id = auth.uid() OR t.carrier_user_id = auth.uid())
    )
    OR porterra_role() = 'admin'
  );

CREATE POLICY tracking_admin_all ON public.tracking_events
  FOR ALL TO authenticated
  USING (porterra_role() = 'admin');

-- ── FUNCIÓN: actualizar carrier credit_score automáticamente ─────────────────
-- Inspirado en Nuvocargo carrier scorecards con OTIF/OTP
-- Fórmula: 500 base + completed×10 - incidents×25, capped 0-1000

CREATE OR REPLACE FUNCTION update_carrier_score()
RETURNS TRIGGER AS $$
DECLARE
  carrier_uid  uuid;
  completadas  int;
  incidentes   int;
  new_score    int;
BEGIN
  -- Obtener el carrier de la transacción
  SELECT carrier_user_id INTO carrier_uid
  FROM public.transactions
  WHERE id = NEW.transaction_id;

  IF carrier_uid IS NULL THEN RETURN NEW; END IF;

  -- Contar eventos del carrier
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'delivered'),
    COUNT(*) FILTER (WHERE event_type = 'incident')
  INTO completadas, incidentes
  FROM public.tracking_events te
  JOIN public.transactions t ON t.id = te.transaction_id
  WHERE t.carrier_user_id = carrier_uid AND te.created_by = carrier_uid;

  -- Calcular score
  new_score := GREATEST(0, LEAST(1000, 500 + (completadas * 10) - (incidentes * 25)));

  -- Actualizar en carrier_profiles
  UPDATE public.carrier_profiles
  SET credit_score = new_score
  WHERE user_id = carrier_uid;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tracking_update_carrier_score
  AFTER INSERT ON public.tracking_events
  FOR EACH ROW
  WHEN (NEW.event_type IN ('delivered', 'incident'))
  EXECUTE FUNCTION update_carrier_score();

-- ── PERMISOS ─────────────────────────────────────────────────────────────────
GRANT SELECT ON public.duca_documents  TO supabase_auth_admin;
GRANT SELECT ON public.tracking_events TO supabase_auth_admin;
