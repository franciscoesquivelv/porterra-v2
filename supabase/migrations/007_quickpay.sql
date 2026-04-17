-- ─────────────────────────────────────────────────────────────────────────────
-- PORTERRA V2 — Migration 007: QuickPay para Carriers
-- El carrier puede adelantar el cobro de un payment_split pendiente
-- descontando un 3% de comisión. PORTERRA desembolsa en < 24h.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quickpay_requests (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id          uuid          NOT NULL REFERENCES public.payment_splits(id) ON DELETE CASCADE,
  carrier_user_id   uuid          NOT NULL REFERENCES auth.users(id),

  gross_amount_usd  numeric(12,2) NOT NULL,   -- monto original del split
  discount_rate     numeric(5,2)  NOT NULL DEFAULT 3.00,
  fee_usd           numeric(12,2) NOT NULL,   -- gross * discount_rate / 100
  net_amount_usd    numeric(12,2) NOT NULL,   -- gross - fee

  status            text          NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'disbursed', 'rejected')),

  requested_at      timestamptz   NOT NULL DEFAULT now(),
  disbursed_at      timestamptz,
  disbursed_by      uuid          REFERENCES auth.users(id),
  notes             text,

  -- Un split solo puede tener una solicitud activa
  UNIQUE (split_id)
);

CREATE INDEX IF NOT EXISTS idx_quickpay_carrier  ON public.quickpay_requests(carrier_user_id, status);
CREATE INDEX IF NOT EXISTS idx_quickpay_status   ON public.quickpay_requests(status, requested_at DESC);

-- RLS
ALTER TABLE public.quickpay_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carrier_own_quickpay"
  ON public.quickpay_requests FOR ALL TO authenticated
  USING  (carrier_user_id = auth.uid())
  WITH CHECK (carrier_user_id = auth.uid());

CREATE POLICY "admin_all_quickpay"
  ON public.quickpay_requests FOR ALL TO authenticated
  USING  ((auth.jwt() -> 'app_metadata' ->> 'porterra_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'porterra_role') = 'admin');
