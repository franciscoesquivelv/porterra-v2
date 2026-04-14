-- ─────────────────────────────────────────────────────────────────────────────
-- PORTERRA V2 — Migration 002: Row Level Security Policies
-- ⛔ Habilitar RLS en TODAS las tablas — requisito bloqueante Fase 1
-- Los roles se leen del JWT claim: auth.jwt() ->> 'porterra_role'
-- ─────────────────────────────────────────────────────────────────────────────

-- ── HELPER FUNCTION ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION porterra_role()
RETURNS text AS $$
  SELECT coalesce(
    auth.jwt() -> 'app_metadata' ->> 'porterra_role',
    auth.jwt() ->> 'porterra_role'
  )
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION porterra_entity_id()
RETURNS uuid AS $$
  SELECT (coalesce(
    auth.jwt() -> 'app_metadata' ->> 'porterra_entity_id',
    auth.jwt() ->> 'porterra_entity_id'
  ))::uuid
$$ LANGUAGE sql STABLE;

-- ── PROFILES ──────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Admin: leer todos los perfiles
CREATE POLICY profiles_admin_select ON public.profiles
  FOR SELECT TO authenticated
  USING (porterra_role() = 'admin');

-- Usuario: leer su propio perfil
CREATE POLICY profiles_user_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Usuario: actualizar su propio perfil (no puede cambiar role/status)
CREATE POLICY profiles_user_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND porterra_role = (SELECT porterra_role FROM public.profiles WHERE user_id = auth.uid())
    AND porterra_status = (SELECT porterra_status FROM public.profiles WHERE user_id = auth.uid())
  );

-- Admin: actualizar cualquier perfil (para aprobar/suspender)
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (porterra_role() = 'admin');

-- Trigger: solo el sistema puede insertar perfiles (via service_role en Server Action)
CREATE POLICY profiles_system_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ── FF PROFILES ───────────────────────────────────────────────────────────────

ALTER TABLE public.ff_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY ff_profiles_admin_select ON public.ff_profiles
  FOR SELECT TO authenticated
  USING (porterra_role() = 'admin');

CREATE POLICY ff_profiles_own_select ON public.ff_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY ff_profiles_own_insert ON public.ff_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY ff_profiles_own_update ON public.ff_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY ff_profiles_admin_update ON public.ff_profiles
  FOR UPDATE TO authenticated
  USING (porterra_role() = 'admin');

-- ── CARRIER PROFILES ──────────────────────────────────────────────────────────

ALTER TABLE public.carrier_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY carrier_profiles_admin_select ON public.carrier_profiles
  FOR SELECT TO authenticated
  USING (porterra_role() = 'admin');

CREATE POLICY carrier_profiles_own_select ON public.carrier_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY carrier_profiles_own_insert ON public.carrier_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY carrier_profiles_own_update ON public.carrier_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- FF puede ver transportistas de su red (habilitado en Fase 2 con tabla de red)
CREATE POLICY carrier_profiles_ff_select ON public.carrier_profiles
  FOR SELECT TO authenticated
  USING (porterra_role() = 'freight_forwarder');

-- ── SESSIONS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_user_select ON public.sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY sessions_admin_select ON public.sessions
  FOR SELECT TO authenticated
  USING (porterra_role() = 'admin');

-- ── PLATFORM CONFIG ───────────────────────────────────────────────────────────

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Solo admin puede leer y modificar configuración
CREATE POLICY config_admin_all ON public.platform_config
  FOR ALL TO authenticated
  USING (porterra_role() = 'admin')
  WITH CHECK (porterra_role() = 'admin');

-- ── AUDIT LOG ─────────────────────────────────────────────────────────────────

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Solo admin puede leer — nadie puede modificar (triggers lo bloquean)
CREATE POLICY audit_log_admin_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (porterra_role() = 'admin');

-- El service_role (backend) puede insertar — RLS bypassed con service_role_key
-- No se necesita policy de INSERT para roles de usuario

-- ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_user_select ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY notifications_user_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND is_read = true);  -- Solo puede marcar como leída

CREATE POLICY notifications_admin_all ON public.notifications
  FOR ALL TO authenticated
  USING (porterra_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- CUSTOM CLAIMS: Función para inyectar porterra_role en el JWT
-- Ejecutar en Supabase Dashboard → Authentication → Hooks (o via trigger)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims    jsonb;
  user_role user_role;
  user_status user_status;
  entity_id uuid;
BEGIN
  claims := event -> 'claims';

  -- Obtener el rol del usuario desde profiles
  SELECT
    p.porterra_role,
    p.porterra_status,
    p.porterra_entity_id
  INTO user_role, user_status, entity_id
  FROM public.profiles p
  WHERE p.user_id = (event ->> 'user_id')::uuid;

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata}',
      coalesce(claims -> 'app_metadata', '{}') ||
      jsonb_build_object(
        'porterra_role',      user_role,
        'porterra_status',    user_status,
        'porterra_entity_id', entity_id
      )
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Otorgar permisos para que Supabase Auth ejecute el hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon;
