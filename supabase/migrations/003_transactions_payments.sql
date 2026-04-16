-- ─────────────────────────────────────────────────────────────────────────────
-- PORTERRA V2 — Migration 003: Transactions & Payment Splits
-- ─────────────────────────────────────────────────────────────────────────────

-- ── TRANSACTIONS ──────────────────────────────────────────────────────────────

CREATE TABLE public.transactions (
  id                    uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  ff_user_id            uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  carrier_user_id       uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  status                transaction_status NOT NULL DEFAULT 'draft',
  -- Carga
  reference_number      text          UNIQUE,           -- Número interno PORTERRA
  cargo_description     text          NOT NULL,
  cargo_type            cargo_type    NOT NULL DEFAULT 'general',
  cargo_weight_kg       numeric(10,2),
  cargo_volume_m3       numeric(10,2),
  -- Ruta
  origin_country        country_code  NOT NULL,
  destination_country   country_code  NOT NULL,
  origin_address        text,
  destination_address   text,
  -- Financiero
  total_amount_usd      numeric(12,2) NOT NULL,
  porterra_fee_usd      numeric(12,2) GENERATED ALWAYS AS (ROUND(total_amount_usd * 0.025, 2)) STORED,
  carrier_payout_usd    numeric(12,2),
  -- DUCA
  duca_number           text,
  duca_status           duca_status   DEFAULT 'draft',
  -- Fechas
  pickup_date           date,
  delivery_date         date,
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  -- Meta
  metadata              jsonb         NOT NULL DEFAULT '{}',
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Número de referencia automático: PRT-2026-0001
CREATE OR REPLACE FUNCTION generate_reference_number()
RETURNS TRIGGER AS $$
DECLARE
  year_str  text := to_char(now(), 'YYYY');
  seq_num   int;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num
  FROM public.transactions
  WHERE to_char(created_at, 'YYYY') = year_str;

  NEW.reference_number := 'PRT-' || year_str || '-' || LPAD(seq_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_reference_number
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION generate_reference_number();

CREATE INDEX idx_transactions_ff_user      ON public.transactions(ff_user_id, status, created_at DESC);
CREATE INDEX idx_transactions_carrier_user ON public.transactions(carrier_user_id, status, created_at DESC);
CREATE INDEX idx_transactions_status       ON public.transactions(status, created_at DESC);

-- ── PAYMENT SPLITS ────────────────────────────────────────────────────────────
-- Pagos fraccionados: un FF puede pagar a un carrier en múltiples partes

CREATE TABLE public.payment_splits (
  id                uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id    uuid          NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  carrier_user_id   uuid          NOT NULL REFERENCES auth.users(id),
  split_label       text          NOT NULL,   -- Ej: "Anticipo 50%", "Saldo final"
  amount_usd        numeric(12,2) NOT NULL,
  split_percentage  numeric(5,2),
  status            payment_status NOT NULL DEFAULT 'pending',
  due_date          date,
  released_at       timestamptz,
  paid_at           timestamptz,
  payment_method    text,                     -- 'bank_transfer' | 'porterra_wallet'
  payment_reference text,
  metadata          jsonb         NOT NULL DEFAULT '{}',
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE TRIGGER payment_splits_updated_at
  BEFORE UPDATE ON public.payment_splits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_payment_splits_transaction ON public.payment_splits(transaction_id);
CREATE INDEX idx_payment_splits_carrier     ON public.payment_splits(carrier_user_id, status, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_splits ENABLE ROW LEVEL SECURITY;

-- Transactions: FF ve las suyas, Carrier ve las asignadas, Admin ve todo
CREATE POLICY transactions_ff_select ON public.transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = ff_user_id OR porterra_role() = 'admin');

CREATE POLICY transactions_carrier_select ON public.transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = carrier_user_id);

CREATE POLICY transactions_ff_insert ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = ff_user_id AND porterra_role() = 'freight_forwarder');

CREATE POLICY transactions_ff_update ON public.transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = ff_user_id AND status NOT IN ('completed', 'cancelled'))
  WITH CHECK (auth.uid() = ff_user_id);

CREATE POLICY transactions_admin_all ON public.transactions
  FOR ALL TO authenticated
  USING (porterra_role() = 'admin');

-- Payment splits: carrier ve los suyos, FF ve los de sus transacciones, Admin ve todo
CREATE POLICY splits_carrier_select ON public.payment_splits
  FOR SELECT TO authenticated
  USING (auth.uid() = carrier_user_id);

CREATE POLICY splits_ff_select ON public.payment_splits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id AND t.ff_user_id = auth.uid()
    )
  );

CREATE POLICY splits_ff_insert ON public.payment_splits
  FOR INSERT TO authenticated
  WITH CHECK (
    porterra_role() = 'freight_forwarder' AND
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id AND t.ff_user_id = auth.uid()
    )
  );

CREATE POLICY splits_admin_all ON public.payment_splits
  FOR ALL TO authenticated
  USING (porterra_role() = 'admin');

-- Permisos para el hook
GRANT SELECT ON public.transactions  TO supabase_auth_admin;
GRANT SELECT ON public.payment_splits TO supabase_auth_admin;
