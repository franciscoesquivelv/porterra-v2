-- ─────────────────────────────────────────────────────────────────────────────
-- PORTERRA V2 — Migration 001: Initial Schema
-- Ejecutar en Supabase SQL Editor o con Supabase CLI
-- ⛔ RLS habilitado en TODAS las tablas desde el inicio
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ENUMS ─────────────────────────────────────────────────────────────────────

CREATE TYPE user_role    AS ENUM ('admin', 'freight_forwarder', 'carrier');
CREATE TYPE user_status  AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE kyc_status   AS ENUM ('not_started', 'submitted', 'approved', 'rejected');
CREATE TYPE country_code AS ENUM ('GT', 'HN', 'SV', 'NI', 'CR', 'PA', 'MX');

-- ── PROFILES ──────────────────────────────────────────────────────────────────
-- Extensión de auth.users con datos específicos de PORTERRA

CREATE TABLE public.profiles (
  id                 uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  porterra_role      user_role     NOT NULL,
  porterra_status    user_status   NOT NULL DEFAULT 'pending',
  kyc_status         kyc_status    NOT NULL DEFAULT 'not_started',
  -- pii_ = Personally Identifiable Information
  pii_full_name      text          NOT NULL,
  pii_phone          text,
  -- enc_ = cifrado AES-256-GCM, hash_ = para búsquedas sin descifrar
  enc_tax_id         text,
  hash_tax_id        text,
  company_name       text,
  company_country    country_code,
  porterra_entity_id uuid,         -- FK a ff_profiles.id o carrier_profiles.id
  avatar_url         text,
  metadata           jsonb         NOT NULL DEFAULT '{}',
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── FF PROFILES ───────────────────────────────────────────────────────────────

CREATE TABLE public.ff_profiles (
  id                uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name      text          NOT NULL,
  country           country_code  NOT NULL,
  contact_email     text          NOT NULL,
  contact_phone     text,
  is_verified       boolean       NOT NULL DEFAULT false,
  verification_date timestamptz,
  credit_limit_usd  numeric(12,2) NOT NULL DEFAULT 0,
  metadata          jsonb         NOT NULL DEFAULT '{}',
  created_at        timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ── CARRIER PROFILES ──────────────────────────────────────────────────────────

CREATE TABLE public.carrier_profiles (
  id                uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pii_full_name     text          NOT NULL,
  enc_id_document   text,         -- Documento de identidad cifrado AES-256
  contact_phone     text          NOT NULL,
  whatsapp_enabled  boolean       NOT NULL DEFAULT true,
  country           country_code  NOT NULL,
  vehicle_type      text,
  vehicle_plate     text,
  is_verified       boolean       NOT NULL DEFAULT false,
  credit_score      integer CHECK (credit_score BETWEEN 0 AND 1000),
  metadata          jsonb         NOT NULL DEFAULT '{}',
  created_at        timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ── SESSIONS ──────────────────────────────────────────────────────────────────

CREATE TABLE public.sessions (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text        NOT NULL,
  ip_address         inet        NOT NULL,
  user_agent         text        NOT NULL,
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_id    ON public.sessions(user_id, is_active);
CREATE INDEX idx_sessions_expires_at ON public.sessions(expires_at);

-- ── PLATFORM CONFIG ───────────────────────────────────────────────────────────

CREATE TABLE public.platform_config (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  key         text        NOT NULL UNIQUE,
  value       text        NOT NULL,
  description text,
  updated_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Valores por defecto
INSERT INTO public.platform_config (key, value, description) VALUES
  ('take_rate_pct',           '2.5',   'Take rate porcentual sobre GMV (%)'),
  ('factoring_discount_rate', '3.5',   'Tasa de descuento para factoring (%)'),
  ('max_transaction_usd',     '100000','Monto máximo por transacción en USD'),
  ('kyc_auto_approve',        'false', 'Aprobar KYC automáticamente (solo dev)');

-- ── AUDIT LOG ─────────────────────────────────────────────────────────────────
-- ⛔ Append-only — triggers bloquean UPDATE, DELETE y TRUNCATE

CREATE TABLE public.audit_log (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Quién
  actor_user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role       user_role   NOT NULL,
  actor_ip         inet,
  actor_user_agent text,
  -- Qué
  event_type       text        NOT NULL,  -- Ej: "transaction.created"
  event_category   text        NOT NULL,  -- Ej: "transaction"
  -- Sobre qué entidad
  entity_type      text,                  -- Ej: "transaction"
  entity_id        uuid,                  -- ID del objeto afectado
  -- Datos del evento
  metadata         jsonb       NOT NULL DEFAULT '{}',
  -- Integridad: SHA-256 para detección de tampering
  checksum         text        NOT NULL
);

-- Índices para queries de auditoría frecuentes
CREATE INDEX idx_audit_actor      ON public.audit_log(actor_user_id, created_at DESC);
CREATE INDEX idx_audit_entity     ON public.audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_event_type ON public.audit_log(event_type, created_at DESC);
CREATE INDEX idx_audit_created_at ON public.audit_log(created_at DESC);

-- Función: bloquear mutaciones en audit_log
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es inmutable: operación % bloqueada por política de seguridad', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  EXECUTE FUNCTION prevent_audit_log_mutation();

-- ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

CREATE TABLE public.notifications (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  body        text        NOT NULL,
  type        text        NOT NULL DEFAULT 'info',
  entity_type text,
  entity_id   uuid,
  is_read     boolean     NOT NULL DEFAULT false,
  sent_via    text[],     -- ['whatsapp', 'email', 'push']
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
