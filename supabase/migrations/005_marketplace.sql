-- ─────────────────────────────────────────────────────────────────────────────
-- PORTERRA V2 — Migration 005: Marketplace de Cargas + Aprobación DUCA
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Qué agrega esta migración y por qué:
--
-- 1. Estado 'published' en transaction_status
--    El ciclo ahora es: draft → published → confirmed → in_transit
--                                → delivered → completed / cancelled
--    'published' = FF terminó de configurar la carga y la abre al mercado.
--    Sin este estado no hay forma de distinguir borradores de cargas activas.
--
-- 2. Tabla load_applications
--    Los carriers no se asignan solos a una carga. Se "postulan" y PORTERRA
--    (admin) elige quién la toma, igual que Nuvocargo en sus primeras etapas.
--    Esto permite controlar calidad del carrier, validar score mínimo y ruta.
--
-- 3. rejection_reason en duca_documents
--    Cuando el SAT/DGA (simulado) rechaza una DUCA, necesita devolver una razón.
--    El FF necesita saber exactamente qué corregir para reenviar.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extender transaction_status con 'published' ───────────────────────────
-- ADD VALUE no puede correr dentro de una transacción en PostgreSQL.
-- Supabase lo maneja bien si lo corremos solo.
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'published' AFTER 'draft';


-- ── 2. Tabla load_applications ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS load_applications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  uuid        NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  carrier_user_id uuid        NOT NULL REFERENCES auth.users(id),

  -- 'pending'  = aplicación recibida, admin no ha decidido
  -- 'accepted' = admin asignó este carrier a la carga
  -- 'rejected' = admin eligió otro carrier
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','accepted','rejected')),

  notes           text,                         -- mensaje opcional del carrier al aplicar
  created_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz,                  -- cuando admin tomó la decisión
  reviewed_by     uuid        REFERENCES auth.users(id),

  -- Un carrier solo puede aplicar una vez por carga
  UNIQUE (transaction_id, carrier_user_id)
);

CREATE INDEX IF NOT EXISTS idx_load_app_transaction
  ON load_applications (transaction_id);
CREATE INDEX IF NOT EXISTS idx_load_app_carrier
  ON load_applications (carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_load_app_status
  ON load_applications (status);


-- ── 3. RLS para load_applications ────────────────────────────────────────────

ALTER TABLE load_applications ENABLE ROW LEVEL SECURITY;

-- Carrier: ve y gestiona solo sus propias aplicaciones
CREATE POLICY "carrier_own_applications"
  ON load_applications FOR ALL TO authenticated
  USING  (carrier_user_id = auth.uid())
  WITH CHECK (carrier_user_id = auth.uid());

-- FF: lectura de aplicaciones sobre sus propias transacciones
-- (para que pueda ver quién aplicó a su carga)
CREATE POLICY "ff_see_applications_on_own_tx"
  ON load_applications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = load_applications.transaction_id
        AND t.ff_user_id = auth.uid()
    )
  );

-- Admin: acceso total
CREATE POLICY "admin_all_load_applications"
  ON load_applications FOR ALL TO authenticated
  USING  ((auth.jwt() -> 'app_metadata' ->> 'porterra_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'porterra_role') = 'admin');


-- ── 4. Agregar rejection_reason a duca_documents ─────────────────────────────

ALTER TABLE duca_documents
  ADD COLUMN IF NOT EXISTS rejection_reason text;
