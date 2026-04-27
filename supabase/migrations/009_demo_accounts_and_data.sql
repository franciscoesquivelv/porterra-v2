-- ─────────────────────────────────────────────────────────────────────────────
-- PORTERRA V2 — Migration 009: Demo Accounts + Full Dataset
--
-- Crea 9 cuentas de demo con password conocido: Demo2026!
--   admin@porterra.app   — Admin
--   ff1@porterra.app     — Express Cargo Guatemala S.A. (FF)
--   ff2@porterra.app     — TransCargo El Salvador S.A. de C.V. (FF)
--   c1@porterra.app      — Carlos Mendoza (carrier GT, score 780)
--   c2@porterra.app      — Roberto Fuentes (carrier HN, score 650)
--   c3@porterra.app      — Miguel Torres (carrier SV, score 820)
--   c4@porterra.app      — Juan García (carrier GT, score 590)
--   c5@porterra.app      — Pedro Morales (carrier HN, score 710)
--   c6@porterra.app      — Andrés López (carrier CR, score 430, pending KYC)
--
-- Dataset:
--   - 20 transacciones distribuidas entre FF1 y FF2
--   - Carriers distribuidos por corredor (GT, HN, SV)
--   - Tracking events ricos en transacciones activas
--   - 3 DUCAs aprobadas, 2 submitted, 2 draft
--   - QuickPay desembolsado (ejemplo end-to-end completo)
--   - Powerloop: carriers con last_known_country poblado
--
-- Idempotente: limpia datos demo antes de insertar.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  -- ── IDs fijos de cuentas demo ──────────────────────────────────────────────
  v_admin uuid := 'a0000000-demo-0000-0000-000000000001'::uuid;
  v_ff1   uuid := 'ff100000-demo-0000-0000-000000000001'::uuid;
  v_ff2   uuid := 'ff200000-demo-0000-0000-000000000002'::uuid;
  v_c1    uuid := 'c1000000-demo-0000-0000-000000000001'::uuid;
  v_c2    uuid := 'c2000000-demo-0000-0000-000000000002'::uuid;
  v_c3    uuid := 'c3000000-demo-0000-0000-000000000003'::uuid;
  v_c4    uuid := 'c4000000-demo-0000-0000-000000000004'::uuid;
  v_c5    uuid := 'c5000000-demo-0000-0000-000000000005'::uuid;
  v_c6    uuid := 'c6000000-demo-0000-0000-000000000006'::uuid;

  -- ── IDs de transacciones ──────────────────────────────────────────────────
  -- FF1 transactions
  tx_f1_comp1 uuid := gen_random_uuid();
  tx_f1_comp2 uuid := gen_random_uuid();
  tx_f1_comp3 uuid := gen_random_uuid();
  tx_f1_tran1 uuid := gen_random_uuid();
  tx_f1_tran2 uuid := gen_random_uuid();
  tx_f1_deliv uuid := gen_random_uuid();
  tx_f1_conf1 uuid := gen_random_uuid();
  tx_f1_conf2 uuid := gen_random_uuid();
  tx_f1_pub1  uuid := gen_random_uuid();
  tx_f1_draft uuid := gen_random_uuid();
  tx_f1_canc  uuid := gen_random_uuid();
  -- FF2 transactions
  tx_f2_comp1 uuid := gen_random_uuid();
  tx_f2_comp2 uuid := gen_random_uuid();
  tx_f2_tran1 uuid := gen_random_uuid();
  tx_f2_deliv uuid := gen_random_uuid();
  tx_f2_conf1 uuid := gen_random_uuid();
  tx_f2_pub1  uuid := gen_random_uuid();
  tx_f2_draft uuid := gen_random_uuid();

  -- QuickPay split id
  qp_split_id uuid := gen_random_uuid();

BEGIN

  -- ══════════════════════════════════════════════════════════════════════════
  -- LIMPIEZA IDEMPOTENTE
  -- ══════════════════════════════════════════════════════════════════════════

  -- Limpiar quickpay_requests de cuentas demo
  DELETE FROM public.quickpay_requests
    WHERE carrier_user_id IN (v_c1,v_c2,v_c3,v_c4,v_c5,v_c6);

  -- Limpiar payment_splits
  DELETE FROM public.payment_splits
    WHERE carrier_user_id IN (v_c1,v_c2,v_c3,v_c4,v_c5,v_c6);

  -- Limpiar tracking, DUCAs, load_applications, transacciones
  DELETE FROM public.tracking_events
    WHERE created_by IN (v_c1,v_c2,v_c3,v_c4,v_c5,v_c6);

  DELETE FROM public.duca_documents
    WHERE ff_user_id IN (v_ff1, v_ff2);

  DELETE FROM public.load_applications
    WHERE carrier_user_id IN (v_c1,v_c2,v_c3,v_c4,v_c5,v_c6);

  DELETE FROM public.transactions
    WHERE ff_user_id IN (v_ff1, v_ff2);

  -- Limpiar perfiles
  DELETE FROM public.ff_profiles      WHERE user_id IN (v_ff1, v_ff2);
  DELETE FROM public.carrier_profiles WHERE user_id IN (v_c1,v_c2,v_c3,v_c4,v_c5,v_c6);
  DELETE FROM public.profiles         WHERE user_id IN (v_admin,v_ff1,v_ff2,v_c1,v_c2,v_c3,v_c4,v_c5,v_c6);

  -- Limpiar auth
  DELETE FROM auth.identities WHERE user_id IN (v_admin,v_ff1,v_ff2,v_c1,v_c2,v_c3,v_c4,v_c5,v_c6);
  DELETE FROM auth.users      WHERE id       IN (v_admin,v_ff1,v_ff2,v_c1,v_c2,v_c3,v_c4,v_c5,v_c6);

  -- ══════════════════════════════════════════════════════════════════════════
  -- AUTH USERS (password: Demo2026!)
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@porterra.app',  crypt('Demo2026!', gen_salt('bf', 10)),
     now(), '{"provider":"email","providers":["email"],"porterra_role":"admin"}'::jsonb, '{}'::jsonb, now(), now()),

    (v_ff1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ff1@porterra.app', crypt('Demo2026!', gen_salt('bf', 10)),
     now(), '{"provider":"email","providers":["email"],"porterra_role":"freight_forwarder"}'::jsonb, '{}'::jsonb, now(), now()),

    (v_ff2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ff2@porterra.app', crypt('Demo2026!', gen_salt('bf', 10)),
     now(), '{"provider":"email","providers":["email"],"porterra_role":"freight_forwarder"}'::jsonb, '{}'::jsonb, now(), now()),

    (v_c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'c1@porterra.app', crypt('Demo2026!', gen_salt('bf', 10)),
     now(), '{"provider":"email","providers":["email"],"porterra_role":"carrier"}'::jsonb, '{}'::jsonb, now(), now()),

    (v_c2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'c2@porterra.app', crypt('Demo2026!', gen_salt('bf', 10)),
     now(), '{"provider":"email","providers":["email"],"porterra_role":"carrier"}'::jsonb, '{}'::jsonb, now(), now()),

    (v_c3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'c3@porterra.app', crypt('Demo2026!', gen_salt('bf', 10)),
     now(), '{"provider":"email","providers":["email"],"porterra_role":"carrier"}'::jsonb, '{}'::jsonb, now(), now()),

    (v_c4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'c4@porterra.app', crypt('Demo2026!', gen_salt('bf', 10)),
     now(), '{"provider":"email","providers":["email"],"porterra_role":"carrier"}'::jsonb, '{}'::jsonb, now(), now()),

    (v_c5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'c5@porterra.app', crypt('Demo2026!', gen_salt('bf', 10)),
     now(), '{"provider":"email","providers":["email"],"porterra_role":"carrier"}'::jsonb, '{}'::jsonb, now(), now()),

    (v_c6, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'c6@porterra.app', crypt('Demo2026!', gen_salt('bf', 10)),
     now(), '{"provider":"email","providers":["email"],"porterra_role":"carrier"}'::jsonb, '{}'::jsonb, now(), now());

  -- ── Auth identities (requeridas para login con email/password) ─────────────

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES
    (v_admin, v_admin, jsonb_build_object('sub',v_admin::text,'email','admin@porterra.app'), 'email','admin@porterra.app', now(),now(),now()),
    (v_ff1,   v_ff1,   jsonb_build_object('sub',v_ff1::text,  'email','ff1@porterra.app'),   'email','ff1@porterra.app',   now(),now(),now()),
    (v_ff2,   v_ff2,   jsonb_build_object('sub',v_ff2::text,  'email','ff2@porterra.app'),   'email','ff2@porterra.app',   now(),now(),now()),
    (v_c1,    v_c1,    jsonb_build_object('sub',v_c1::text,   'email','c1@porterra.app'),    'email','c1@porterra.app',    now(),now(),now()),
    (v_c2,    v_c2,    jsonb_build_object('sub',v_c2::text,   'email','c2@porterra.app'),    'email','c2@porterra.app',    now(),now(),now()),
    (v_c3,    v_c3,    jsonb_build_object('sub',v_c3::text,   'email','c3@porterra.app'),    'email','c3@porterra.app',    now(),now(),now()),
    (v_c4,    v_c4,    jsonb_build_object('sub',v_c4::text,   'email','c4@porterra.app'),    'email','c4@porterra.app',    now(),now(),now()),
    (v_c5,    v_c5,    jsonb_build_object('sub',v_c5::text,   'email','c5@porterra.app'),    'email','c5@porterra.app',    now(),now(),now()),
    (v_c6,    v_c6,    jsonb_build_object('sub',v_c6::text,   'email','c6@porterra.app'),    'email','c6@porterra.app',    now(),now(),now());

  -- ══════════════════════════════════════════════════════════════════════════
  -- PROFILES
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO public.profiles (user_id, porterra_role, porterra_status, kyc_status, pii_full_name, company_name, company_country)
  VALUES
    (v_admin, 'admin',             'active',  'approved', 'Admin Porterra',               'PORTERRA',                                 'GT'),
    (v_ff1,   'freight_forwarder', 'active',  'approved', 'Luis Fernando Castillo',       'Express Cargo Guatemala S.A.',             'GT'),
    (v_ff2,   'freight_forwarder', 'active',  'approved', 'Ana Patricia Ramos',           'TransCargo El Salvador S.A. de C.V.',      'SV'),
    (v_c1,    'carrier',           'active',  'approved', 'Carlos Mendoza Pérez',         NULL,                                       'GT'),
    (v_c2,    'carrier',           'active',  'approved', 'Roberto Fuentes Aguilar',      NULL,                                       'HN'),
    (v_c3,    'carrier',           'active',  'approved', 'Miguel Torres Vásquez',        NULL,                                       'SV'),
    (v_c4,    'carrier',           'active',  'approved', 'Juan García Hernández',        NULL,                                       'GT'),
    (v_c5,    'carrier',           'active',  'approved', 'Pedro Morales Contreras',      NULL,                                       'HN'),
    (v_c6,    'carrier',           'pending', 'submitted','Andrés López Ramírez',         NULL,                                       'CR');

  -- ── FF Profiles ────────────────────────────────────────────────────────────

  INSERT INTO public.ff_profiles (user_id, company_name, country, contact_email, contact_phone, is_verified, verification_date, credit_limit_usd)
  VALUES
    (v_ff1, 'Express Cargo Guatemala S.A.',          'GT', 'ff1@porterra.app', '+502-2200-1100', true, now()-interval '60 days', 500000.00),
    (v_ff2, 'TransCargo El Salvador S.A. de C.V.',   'SV', 'ff2@porterra.app', '+503-2200-2200', true, now()-interval '45 days', 350000.00);

  -- ── Carrier Profiles ───────────────────────────────────────────────────────

  INSERT INTO public.carrier_profiles
    (user_id, pii_full_name, contact_phone, country, vehicle_type, vehicle_plate, is_verified, credit_score, last_known_country, last_delivery_at)
  VALUES
    (v_c1, 'Carlos Mendoza Pérez',    '+502-5500-1111', 'GT', 'Trailer 40ft',  'P-11111', true,  780, 'HN', now()-interval '3 days'),
    (v_c2, 'Roberto Fuentes Aguilar', '+504-9900-2222', 'HN', 'Trailer 40ft',  'P-22222', true,  650, 'SV', now()-interval '5 days'),
    (v_c3, 'Miguel Torres Vásquez',   '+503-7700-3333', 'SV', 'Camión 10 ton', 'P-33333', true,  820, 'GT', now()-interval '2 days'),
    (v_c4, 'Juan García Hernández',   '+502-4400-4444', 'GT', 'Trailer 20ft',  'P-44444', true,  590, 'GT', now()-interval '8 days'),
    (v_c5, 'Pedro Morales Contreras', '+504-8800-5555', 'HN', 'Camión 10 ton', 'P-55555', true,  710, 'NI', now()-interval '4 days'),
    (v_c6, 'Andrés López Ramírez',    '+506-6600-6666', 'CR', 'Trailer 40ft',  'P-66666', false, 430, NULL, NULL);

  -- ══════════════════════════════════════════════════════════════════════════
  -- TRANSACCIONES — FF1: Express Cargo Guatemala
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO transactions (id, ff_user_id, carrier_user_id, status,
    cargo_description, cargo_type, cargo_weight_kg, cargo_volume_m3,
    origin_country, destination_country, origin_address, destination_address,
    total_amount_usd, carrier_payout_usd,
    pickup_date, delivery_date, completed_at, cancelled_at, created_at)
  VALUES
    -- COMPLETADAS FF1
    (tx_f1_comp1, v_ff1, v_c1, 'completed',
     'Textiles y confección — 240 cajas palletizadas', 'general', 8400, 42.0,
     'GT', 'HN', 'Bodega ZOLIC Zona Franca, Ciudad de Guatemala',
     'Distribuidora Tegus, San Pedro Sula HN',
     45200.00, 36160.00,
     (now()-interval '88 days')::date, (now()-interval '86 days')::date,
     now()-interval '86 days', NULL, now()-interval '92 days'),

    (tx_f1_comp2, v_ff1, v_c3, 'completed',
     'Maquinaria agrícola — tractores y repuestos OEM', 'general', 18900, 120.0,
     'GT', 'SV', 'Puerto Santo Tomás de Castilla, GT',
     'Agroindustrias del Pacífico, Santa Ana SV',
     78500.00, 62800.00,
     (now()-interval '60 days')::date, (now()-interval '57 days')::date,
     now()-interval '57 days', NULL, now()-interval '64 days'),

    (tx_f1_comp3, v_ff1, v_c4, 'completed',
     'Productos farmacéuticos — medicamentos de patente', 'general', 3200, 18.0,
     'GT', 'MX', 'Zona Industrial Villa Nueva GT',
     'Laboratorios Farmacéuticos, CDMX MX',
     94600.00, 75680.00,
     (now()-interval '45 days')::date, (now()-interval '42 days')::date,
     now()-interval '42 days', NULL, now()-interval '48 days'),

    -- EN TRÁNSITO FF1
    (tx_f1_tran1, v_ff1, v_c1, 'in_transit',
     'Materiales de construcción — cemento y varillas de acero', 'general', 22000, 85.0,
     'GT', 'HN', 'Planta Cementos Progreso, Sanarate GT',
     'Constructora Capital, Tegucigalpa HN',
     55000.00, 44000.00,
     (now()-interval '4 days')::date, (now()+interval '1 day')::date,
     NULL, NULL, now()-interval '6 days'),

    (tx_f1_tran2, v_ff1, v_c2, 'in_transit',
     'Insumos agroindustriales — fertilizantes líquidos', 'general', 14500, 58.0,
     'GT', 'SV', 'Bodega Agroquímicos Villa Canales GT',
     'Cooperativa Agrícola, San Miguel SV',
     41200.00, 32960.00,
     (now()-interval '2 days')::date, (now()+interval '2 days')::date,
     NULL, NULL, now()-interval '4 days'),

    -- ENTREGADA FF1 (pendiente confirmación)
    (tx_f1_deliv, v_ff1, v_c3, 'delivered',
     'Electrodomésticos línea blanca — neveras y lavadoras', 'general', 7600, 52.0,
     'GT', 'SV', 'Bodega Samsung Guatemala, Zona 12',
     'Tienda Curacao, San Salvador SV',
     67300.00, 53840.00,
     (now()-interval '4 days')::date, (now()-interval '1 day')::date,
     NULL, NULL, now()-interval '6 days'),

    -- CONFIRMADAS FF1
    (tx_f1_conf1, v_ff1, v_c5, 'confirmed',
     'Ropa y accesorios — temporada verano 2026', 'general', 5200, 34.0,
     'GT', 'HN', 'Centro Distribución Maquilas GT',
     'Distribuidora de Moda, Tegucigalpa HN',
     38900.00, 31120.00,
     (now()+interval '1 day')::date, (now()+interval '4 days')::date,
     NULL, NULL, now()-interval '1 day'),

    (tx_f1_conf2, v_ff1, v_c1, 'confirmed',
     'Autopartes y refacciones — repuestos OEM marca Toyota', 'general', 11200, 44.0,
     'MX', 'GT', 'Planta Toyota, Monterrey MX',
     'Distribuidora Automotriz, Ciudad de Guatemala',
     52400.00, 41920.00,
     (now()+interval '2 days')::date, (now()+interval '5 days')::date,
     NULL, NULL, now()-interval '1 day'),

    -- PUBLICADA FF1 (marketplace)
    (tx_f1_pub1, v_ff1, NULL, 'published',
     'Café verde lavado — sacos 60kg certificados Rainforest', 'general', 12000, 38.0,
     'GT', 'MX', 'Cooperativa ANACAFÉ, Antigua Guatemala',
     'Importadora Café Premium, Guadalajara MX',
     48600.00, 38880.00,
     (now()+interval '3 days')::date, (now()+interval '7 days')::date,
     NULL, NULL, now()),

    -- BORRADOR FF1
    (tx_f1_draft, v_ff1, NULL, 'draft',
     'Madera aserrada y tableros MDF — carga completa', 'general', 19400, 96.0,
     'GT', 'PA', NULL, NULL,
     44100.00, 35280.00,
     NULL, NULL,
     NULL, NULL, now()),

    -- CANCELADA FF1
    (tx_f1_canc, v_ff1, NULL, 'cancelled',
     'Materiales eléctricos — cables y tableros industriales', 'general', 8800, 32.0,
     'NI', 'GT', NULL, NULL,
     33500.00, 26800.00,
     NULL, NULL,
     now()-interval '18 days', now()-interval '22 days');

  -- ══════════════════════════════════════════════════════════════════════════
  -- TRANSACCIONES — FF2: TransCargo El Salvador
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO transactions (id, ff_user_id, carrier_user_id, status,
    cargo_description, cargo_type, cargo_weight_kg, cargo_volume_m3,
    origin_country, destination_country, origin_address, destination_address,
    total_amount_usd, carrier_payout_usd,
    pickup_date, delivery_date, completed_at, created_at)
  VALUES
    -- COMPLETADAS FF2
    (tx_f2_comp1, v_ff2, v_c2, 'completed',
     'Productos alimenticios secos — granos y cereales empacados', 'general', 12600, 64.0,
     'SV', 'GT', 'Silos CESSA, San Salvador SV',
     'Distribuidora de Alimentos, Ciudad de Guatemala',
     32800.00, 26240.00,
     (now()-interval '70 days')::date, (now()-interval '68 days')::date,
     now()-interval '68 days', now()-interval '74 days'),

    (tx_f2_comp2, v_ff2, v_c3, 'completed',
     'Café molido empacado al vacío — marca El Cafetalero', 'general', 6400, 28.0,
     'SV', 'HN', 'Planta procesadora Café Chaparrastique, SV',
     'Supermercados La Colonia, San Pedro Sula HN',
     29400.00, 23520.00,
     (now()-interval '40 days')::date, (now()-interval '38 days')::date,
     now()-interval '38 days', now()-interval '43 days'),

    -- EN TRÁNSITO FF2
    (tx_f2_tran1, v_ff2, v_c5, 'in_transit',
     'Fertilizantes granulados — sulfato de amonio y urea', 'general', 18200, 72.0,
     'SV', 'NI', 'Puerto Acajutla, Sonsonate SV',
     'Cooperativa Agrícola Los Cedros, Managua NI',
     38600.00, 30880.00,
     (now()-interval '3 days')::date, (now()+interval '2 days')::date,
     NULL, now()-interval '5 days'),

    -- ENTREGADA FF2 (pendiente confirmación)
    (tx_f2_deliv, v_ff2, v_c2, 'delivered',
     'Bebidas carbonatadas — lote exportación planta Cuscatlán', 'general', 9800, 42.0,
     'SV', 'GT', 'Planta embotelladora La Constancia, SV',
     'Distribuidora Regional, Escuintla GT',
     24800.00, 19840.00,
     (now()-interval '3 days')::date, now()::date,
     NULL, now()-interval '5 days'),

    -- CONFIRMADA FF2
    (tx_f2_conf1, v_ff2, v_c4, 'confirmed',
     'Azúcar cruda certificada — exportación LAICA', 'general', 24000, 92.0,
     'SV', 'MX', 'Ingenio El Ángel, Santa Ana SV',
     'Importadora Dulce México, Mérida MX',
     62400.00, 49920.00,
     (now()+interval '2 days')::date, (now()+interval '6 days')::date,
     NULL, now()-interval '1 day'),

    -- PUBLICADA FF2 (marketplace)
    (tx_f2_pub1, v_ff2, NULL, 'published',
     'Piñas tropicales frescas — calibre exportación ANEBERRIES', 'general', 8400, 36.0,
     'SV', 'MX', 'Zona franca San Bartolo, SV',
     'Importadora Frutas del Trópico, CDMX MX',
     28200.00, 22560.00,
     (now()+interval '4 days')::date, (now()+interval '8 days')::date,
     NULL, now()),

    -- BORRADOR FF2
    (tx_f2_draft, v_ff2, NULL, 'draft',
     'Calzado y accesorios de cuero — lote exportación', 'general', 4200, 24.0,
     'SV', 'CR', NULL, NULL,
     19800.00, 15840.00,
     NULL, now());

  -- ══════════════════════════════════════════════════════════════════════════
  -- PAYMENT SPLITS
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO payment_splits
    (id, transaction_id, carrier_user_id, split_label, amount_usd, split_percentage,
     status, due_date, released_at, paid_at, payment_method, created_at)
  VALUES
    -- FF1 comp1 (C1) — pagados
    (gen_random_uuid(), tx_f1_comp1, v_c1, 'Anticipo 50%',  18080.00, 50, 'paid',
     (now()-interval '86 days')::date, now()-interval '87 days', now()-interval '86 days',
     'bank_transfer', now()-interval '90 days'),
    (gen_random_uuid(), tx_f1_comp1, v_c1, 'Saldo final 50%',18080.00,50, 'paid',
     (now()-interval '83 days')::date, now()-interval '86 days', now()-interval '83 days',
     'bank_transfer', now()-interval '90 days'),

    -- FF1 comp2 (C3) — pagados
    (gen_random_uuid(), tx_f1_comp2, v_c3, 'Anticipo 50%',  31400.00, 50, 'paid',
     (now()-interval '57 days')::date, now()-interval '58 days', now()-interval '57 days',
     'bank_transfer', now()-interval '62 days'),
    (gen_random_uuid(), tx_f1_comp2, v_c3, 'Saldo final 50%',31400.00,50, 'paid',
     (now()-interval '54 days')::date, now()-interval '57 days', now()-interval '54 days',
     'bank_transfer', now()-interval '62 days'),

    -- FF1 comp3 (C4) — pagados
    (gen_random_uuid(), tx_f1_comp3, v_c4, 'Anticipo 50%',  37840.00, 50, 'paid',
     (now()-interval '42 days')::date, now()-interval '43 days', now()-interval '42 days',
     'bank_transfer', now()-interval '46 days'),
    (gen_random_uuid(), tx_f1_comp3, v_c4, 'Saldo final 50%',37840.00,50, 'paid',
     (now()-interval '39 days')::date, now()-interval '42 days', now()-interval '39 days',
     'bank_transfer', now()-interval '46 days'),

    -- FF1 tran1 (C1) — anticipo liberado, saldo pendiente
    (gen_random_uuid(), tx_f1_tran1, v_c1, 'Anticipo 50%',  22000.00, 50, 'released',
     now()::date, now()-interval '4 days', NULL,
     'porterra_wallet', now()-interval '6 days'),
    (gen_random_uuid(), tx_f1_tran1, v_c1, 'Saldo final 50%',22000.00,50, 'pending',
     (now()+interval '3 days')::date, NULL, NULL,
     NULL, now()-interval '6 days'),

    -- FF1 tran2 (C2) — anticipo liberado, saldo pendiente
    (gen_random_uuid(), tx_f1_tran2, v_c2, 'Anticipo 50%',  16480.00, 50, 'released',
     now()::date, now()-interval '2 days', NULL,
     'porterra_wallet', now()-interval '4 days'),
    (gen_random_uuid(), tx_f1_tran2, v_c2, 'Saldo final 50%',16480.00,50, 'pending',
     (now()+interval '4 days')::date, NULL, NULL,
     NULL, now()-interval '4 days'),

    -- FF1 deliv (C3) — anticipo liberado, saldo liberado (entregado, pendiente confirmación)
    (gen_random_uuid(), tx_f1_deliv, v_c3, 'Anticipo 50%',  26920.00, 50, 'released',
     (now()-interval '4 days')::date, now()-interval '4 days', NULL,
     'porterra_wallet', now()-interval '6 days'),
    (gen_random_uuid(), tx_f1_deliv, v_c3, 'Saldo final 50%',26920.00,50, 'pending',
     now()::date, NULL, NULL,
     NULL, now()-interval '6 days'),

    -- FF1 conf1 (C5) — ambos pendientes
    (gen_random_uuid(), tx_f1_conf1, v_c5, 'Anticipo 50%',  15560.00, 50, 'pending',
     (now()+interval '1 day')::date, NULL, NULL,
     NULL, now()-interval '1 day'),
    (gen_random_uuid(), tx_f1_conf1, v_c5, 'Saldo final 50%',15560.00,50, 'pending',
     (now()+interval '7 days')::date, NULL, NULL,
     NULL, now()-interval '1 day'),

    -- FF1 conf2 (C1) — ambos pendientes
    (gen_random_uuid(), tx_f1_conf2, v_c1, 'Anticipo 50%',  20960.00, 50, 'pending',
     (now()+interval '2 days')::date, NULL, NULL,
     NULL, now()-interval '1 day'),
    (gen_random_uuid(), tx_f1_conf2, v_c1, 'Saldo final 50%',20960.00,50, 'pending',
     (now()+interval '8 days')::date, NULL, NULL,
     NULL, now()-interval '1 day'),

    -- FF2 comp1 (C2) — pagados
    (gen_random_uuid(), tx_f2_comp1, v_c2, 'Anticipo 50%',  13120.00, 50, 'paid',
     (now()-interval '68 days')::date, now()-interval '69 days', now()-interval '68 days',
     'bank_transfer', now()-interval '72 days'),
    (gen_random_uuid(), tx_f2_comp1, v_c2, 'Saldo final 50%',13120.00,50, 'paid',
     (now()-interval '65 days')::date, now()-interval '68 days', now()-interval '65 days',
     'bank_transfer', now()-interval '72 days'),

    -- FF2 comp2 (C3) — pagados
    (gen_random_uuid(), tx_f2_comp2, v_c3, 'Anticipo 50%',  11760.00, 50, 'paid',
     (now()-interval '38 days')::date, now()-interval '39 days', now()-interval '38 days',
     'bank_transfer', now()-interval '41 days'),
    (gen_random_uuid(), tx_f2_comp2, v_c3, 'Saldo final 50%',11760.00,50, 'paid',
     (now()-interval '35 days')::date, now()-interval '38 days', now()-interval '35 days',
     'bank_transfer', now()-interval '41 days'),

    -- FF2 tran1 (C5) — anticipo liberado
    (gen_random_uuid(), tx_f2_tran1, v_c5, 'Anticipo 50%',  15440.00, 50, 'released',
     now()::date, now()-interval '3 days', NULL,
     'porterra_wallet', now()-interval '5 days'),
    (gen_random_uuid(), tx_f2_tran1, v_c5, 'Saldo final 50%',15440.00,50, 'pending',
     (now()+interval '4 days')::date, NULL, NULL,
     NULL, now()-interval '5 days'),

    -- FF2 deliv (C2) — QuickPay split (target para el QP disbursed)
    (qp_split_id,       tx_f2_deliv, v_c2, 'Saldo total',   19840.00,100, 'released',
     now()::date, now(), NULL,
     'porterra_wallet', now()-interval '5 days'),

    -- FF2 conf1 (C4) — pendientes
    (gen_random_uuid(), tx_f2_conf1, v_c4, 'Anticipo 50%',  24960.00, 50, 'pending',
     (now()+interval '2 days')::date, NULL, NULL,
     NULL, now()-interval '1 day'),
    (gen_random_uuid(), tx_f2_conf1, v_c4, 'Saldo final 50%',24960.00,50, 'pending',
     (now()+interval '9 days')::date, NULL, NULL,
     NULL, now()-interval '1 day');

  -- ══════════════════════════════════════════════════════════════════════════
  -- QUICKPAY REQUEST — ejemplo end-to-end: C2 cobra antes usando el QP
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO public.quickpay_requests
    (split_id, carrier_user_id, gross_amount_usd, discount_rate, fee_usd, net_amount_usd,
     status, requested_at, disbursed_at, disbursed_by, notes)
  VALUES
    (qp_split_id, v_c2, 19840.00, 3.00, 595.20, 19244.80,
     'disbursed', now()-interval '4 hours', now()-interval '2 hours',
     v_admin, 'Desembolso aprobado. Transferencia procesada a cuenta BACn Honduras del carrier.');

  -- ══════════════════════════════════════════════════════════════════════════
  -- TRACKING EVENTS — viajes activos y completados
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO tracking_events
    (transaction_id, event_type, country, location_name, notes, created_by, created_at)
  VALUES
    -- ── FF1 comp1 GT→HN (C1) ───────────────────────────────────────────────
    (tx_f1_comp1,'origin_pickup',            'GT','Bodega ZOLIC Zona Franca GT',
     'Carga recogida. 240 cajas palletizadas en perfecto estado.', v_c1, now()-interval '90 days'),
    (tx_f1_comp1,'border_approach',          'GT','Aduana El Florido',
     'Llegando a frontera GT/HN. Documentación lista.',            v_c1, now()-interval '89 days 8 hours'),
    (tx_f1_comp1,'border_crossing_complete', 'HN','Aduana Agua Caliente',
     'Cruce aprobado sin incidencias. DUCA validada.',             v_c1, now()-interval '89 days 2 hours'),
    (tx_f1_comp1,'delivered',                'HN','Distribuidora Tegus, San Pedro Sula',
     'Entrega completa. Receptor: Carlos Membreño. 240/240 cajas.',v_c1, now()-interval '88 days'),

    -- ── FF1 comp2 GT→SV (C3) ───────────────────────────────────────────────
    (tx_f1_comp2,'origin_pickup',            'GT','Puerto Santo Tomás de Castilla',
     '3 tractores cargados. Sellados y amarrados.',                 v_c3, now()-interval '63 days'),
    (tx_f1_comp2,'in_transit',               'GT','CA-1 Sur hacia frontera',
     'En ruta. ETA frontera: 6 horas.',                            v_c3, now()-interval '62 days 18 hours'),
    (tx_f1_comp2,'border_crossing_start',    'GT','Aduana Pedro de Alvarado',
     'Iniciando trámite. DUCA-T presentada al agente.',            v_c3, now()-interval '62 days 10 hours'),
    (tx_f1_comp2,'customs_cleared',          'GT','Aduana Pedro de Alvarado',
     'DUCA aprobada. Autorización de salida emitida.',              v_c3, now()-interval '62 days 4 hours'),
    (tx_f1_comp2,'in_transit_destination',   'SV','Autopista del Norte, Santa Ana SV',
     'Ingresando a El Salvador. ETA: 3 horas.',                    v_c3, now()-interval '61 days 22 hours'),
    (tx_f1_comp2,'delivered',                'SV','Agroindustrias del Pacífico, Santa Ana',
     'Descarga completa. 3 tractores entregados OK.',               v_c3, now()-interval '61 days 12 hours'),

    -- ── FF1 tran1 GT→HN (C1) — activo ─────────────────────────────────────
    (tx_f1_tran1,'origin_pickup',            'GT','Planta Cementos Progreso, Sanarate',
     '22 toneladas de cemento y varilla cargadas.',                 v_c1, now()-interval '4 days'),
    (tx_f1_tran1,'in_transit',               'GT','CA-9 Norte, Zacapa GT',
     'En ruta hacia frontera El Florido. Sin novedades.',           v_c1, now()-interval '3 days 16 hours'),
    (tx_f1_tran1,'border_crossing_start',    'GT','Aduana El Florido',
     'Presentando DUCA al inspector. En espera de revisión.',       v_c1, now()-interval '3 days 8 hours'),
    (tx_f1_tran1,'border_crossing_complete', 'HN','Aduana Agua Caliente',
     'Cruce aprobado. Ingresando a Honduras.',                      v_c1, now()-interval '3 days 2 hours'),
    (tx_f1_tran1,'in_transit_destination',   'HN','CA-5 hacia Tegucigalpa',
     'En tránsito final. ETA destino: mañana temprano.',            v_c1, now()-interval '2 days'),

    -- ── FF1 tran2 GT→SV (C2) — activo ─────────────────────────────────────
    (tx_f1_tran2,'origin_pickup',            'GT','Bodega Agroquímicos Villa Canales',
     'Fertilizantes cargados en cisterna. Sellos aplicados.',       v_c2, now()-interval '2 days'),
    (tx_f1_tran2,'in_transit',               'GT','CA-1 Sur, Escuintla GT',
     'En ruta hacia frontera Las Chinamas.',                        v_c2, now()-interval '1 day 18 hours'),
    (tx_f1_tran2,'border_approach',          'GT','Aduana San Cristóbal Frontera',
     'En fila de espera. Aproximadamente 2 horas para trámite.',    v_c2, now()-interval '1 day 10 hours'),

    -- ── FF1 deliv GT→SV (C3) — entregado esperando confirmación ───────────
    (tx_f1_deliv,'origin_pickup',            'GT','Bodega Samsung Guatemala, Zona 12',
     '76 pallets de línea blanca cargados. Inventario verificado.', v_c3, now()-interval '5 days'),
    (tx_f1_deliv,'in_transit',               'GT','Autopista CA-1 sur',
     'En ruta. Carga refrigerada monitoreada.',                     v_c3, now()-interval '4 days 20 hours'),
    (tx_f1_deliv,'border_crossing_complete', 'SV','Aduana Las Chinamas',
     'Cruce SV aprobado en tiempo récord. 45 minutos.',             v_c3, now()-interval '3 days 14 hours'),
    (tx_f1_deliv,'delivered',                'SV','Tienda Curacao, San Salvador',
     '76 pallets entregados. Firmado por Jefe de Bodega Curacao.',  v_c3, now()-interval '1 day'),

    -- ── FF2 comp1 SV→GT (C2) ───────────────────────────────────────────────
    (tx_f2_comp1,'origin_pickup',            'SV','Silos CESSA, San Salvador',
     '12.6 toneladas granos cargados en camión de tolva.',          v_c2, now()-interval '73 days'),
    (tx_f2_comp1,'border_crossing_complete', 'GT','Aduana Pedro de Alvarado',
     'Cruce aprobado. Mercancía despachada sin retenciones.',        v_c2, now()-interval '71 days'),
    (tx_f2_comp1,'delivered',                'GT','Distribuidora de Alimentos, Ciudad de Guatemala',
     'Descarga completada. Peso verificado: 12,480 kg.',             v_c2, now()-interval '70 days'),

    -- ── FF2 tran1 SV→NI (C5) — activo ─────────────────────────────────────
    (tx_f2_tran1,'origin_pickup',            'SV','Puerto Acajutla, Sonsonate',
     'Fertilizantes granulados cargados. 18.2 toneladas.',          v_c5, now()-interval '3 days'),
    (tx_f2_tran1,'in_transit',               'SV','CA-1 sur, Usulután SV',
     'En ruta hacia Honduras. Temperatura ambiente estable.',       v_c5, now()-interval '2 days 12 hours'),
    (tx_f2_tran1,'border_crossing_start',    'HN','Aduana El Amatillo HN/SV',
     'Iniciando trámite en aduana HN. Esperando inspector.',        v_c5, now()-interval '1 day 18 hours'),
    (tx_f2_tran1,'border_crossing_complete', 'HN','Aduana El Amatillo',
     'Cruce aprobado. Tránsito por Honduras autorizado.',           v_c5, now()-interval '1 day 10 hours'),
    (tx_f2_tran1,'in_transit_destination',   'HN','CA-1 hacia Nicaragua',
     'En tránsito por Honduras. ETA frontera NI: mañana.',          v_c5, now()-interval '18 hours'),

    -- ── FF2 deliv SV→GT (C2) — entregado ──────────────────────────────────
    (tx_f2_deliv,'origin_pickup',            'SV','Planta embotelladora La Constancia',
     '9.8 toneladas bebidas cargadas. Temperatura controlada.',     v_c2, now()-interval '4 days'),
    (tx_f2_deliv,'border_crossing_complete', 'GT','Aduana San Cristóbal',
     'Cruce aprobado. Inspección rápida, sin novedad.',              v_c2, now()-interval '2 days'),
    (tx_f2_deliv,'delivered',                'GT','Distribuidora Regional, Escuintla',
     '9,780 kg entregados. Temperatura de cadena fría mantenida.',  v_c2, now()-interval '4 hours');

  -- ══════════════════════════════════════════════════════════════════════════
  -- DUCA DOCUMENTS
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO duca_documents (
    transaction_id, ff_user_id, status, duca_number,
    pais_procedencia, pais_destino, aduana_inicio, aduana_destino,
    exportador_nombre, exportador_tipo_doc, exportador_numero_doc, exportador_pais_emision,
    importador_nombre, importador_tipo_doc, importador_numero_doc, importador_pais_emision,
    transportista_nombre, vehiculo_placa,
    conductor_primer_nombre, conductor_primer_apellido,
    conductor_tipo_doc, conductor_numero_doc, conductor_licencia, conductor_pais_exp,
    mercancias, ruta_transito,
    valor_transaccion, gastos_transporte, gastos_seguro,
    submitted_at, approved_at, created_at)
  VALUES
    -- DUCA aprobada: FF1 comp1 GT→HN
    (tx_f1_comp1, v_ff1, 'approved', 'DUCA-T-2026-00001',
     'GT','HN','El Florido','Agua Caliente',
     'Express Cargo Guatemala S.A.','NIT','CF12345-6','GT',
     'Distribuidora Tegus S. de R.L.','RTN','05019999012345','HN',
     'Transportes Rápidos GT','P-11111',
     'Carlos','Mendoza','DUI','05234567-8','TRAN-2024-GT-0045','GT',
     '[{"codigo_sac":"6109.10.00","descripcion":"Camisetas de algodón","cantidad_bultos":240,"clase_bultos":"Cajas","pais_origen":"GT","peso_bruto_kg":8400}]'::jsonb,
     '[{"pais":"GT","aduana":"El Florido"},{"pais":"HN","aduana":"Agua Caliente"}]'::jsonb,
     45200.00, 1808.00, 452.00,
     now()-interval '91 days', now()-interval '90 days', now()-interval '92 days'),

    -- DUCA aprobada: FF1 comp2 GT→SV
    (tx_f1_comp2, v_ff1, 'approved', 'DUCA-T-2026-00002',
     'GT','SV','Pedro de Alvarado','Las Chinamas',
     'Express Cargo Guatemala S.A.','NIT','CF12345-6','GT',
     'Agroindustrias del Pacífico S.A.','NIT','0614-271190-102-3','SV',
     'Transportes GT Express','P-33333',
     'Miguel','Torres','DUI','03456789-0','TRAN-2023-SV-0088','SV',
     '[{"codigo_sac":"8432.10.00","descripcion":"Tractores agrícolas","cantidad_bultos":3,"clase_bultos":"Unidades","pais_origen":"US","peso_bruto_kg":18900}]'::jsonb,
     '[{"pais":"GT","aduana":"Pedro de Alvarado"},{"pais":"SV","aduana":"Las Chinamas"}]'::jsonb,
     78500.00, 3140.00, 785.00,
     now()-interval '63 days', now()-interval '62 days', now()-interval '65 days'),

    -- DUCA aprobada: FF2 comp1 SV→GT
    (tx_f2_comp1, v_ff2, 'approved', 'DUCA-T-2026-00003',
     'SV','GT','Las Chinamas','San Cristóbal',
     'TransCargo El Salvador S.A. de C.V.','NIT','0614-010101-001-0','SV',
     'Distribuidora de Alimentos GT S.A.','NIT','87654321-K','GT',
     'Transportes del Istmo','P-22222',
     'Roberto','Fuentes','DUI','07891234-5','TRAN-2024-HN-0033','HN',
     '[{"codigo_sac":"1001.99.00","descripcion":"Trigo y cereales","cantidad_bultos":252,"clase_bultos":"Sacos","pais_origen":"HN","peso_bruto_kg":12600}]'::jsonb,
     '[{"pais":"SV","aduana":"Las Chinamas"},{"pais":"GT","aduana":"San Cristóbal"}]'::jsonb,
     32800.00, 1312.00, 328.00,
     now()-interval '73 days', now()-interval '72 days', now()-interval '74 days'),

    -- DUCA submitted: FF1 tran1 GT→HN (en revisión SAT/DGA)
    (tx_f1_tran1, v_ff1, 'submitted', NULL,
     'GT','HN','El Florido','Agua Caliente',
     'Express Cargo Guatemala S.A.','NIT','CF12345-6','GT',
     'Constructora Capital GT S.A.','NIT','7654321-0','GT',
     'Transportes Rápidos GT','P-11111',
     'Carlos','Mendoza','DUI','05234567-8','TRAN-2024-GT-0045','GT',
     '[{"codigo_sac":"2523.29.00","descripcion":"Cemento Portland y varilla corrugada","cantidad_bultos":440,"clase_bultos":"Sacos","pais_origen":"GT","peso_bruto_kg":22000}]'::jsonb,
     '[{"pais":"GT","aduana":"El Florido"},{"pais":"HN","aduana":"Agua Caliente"}]'::jsonb,
     55000.00, 2200.00, 550.00,
     now()-interval '5 days', NULL, now()-interval '6 days'),

    -- DUCA submitted: FF2 tran1 SV→NI (en revisión)
    (tx_f2_tran1, v_ff2, 'submitted', NULL,
     'SV','NI','El Amatillo','Peñas Blancas',
     'TransCargo El Salvador S.A. de C.V.','NIT','0614-010101-001-0','SV',
     'Cooperativa Agrícola Los Cedros','RUC','J0310000012345','NI',
     'Transportes del Istmo','P-55555',
     'Pedro','Morales','DUI','08901234-6','TRAN-2023-HN-0091','HN',
     '[{"codigo_sac":"3102.10.00","descripcion":"Sulfato de amonio granulado","cantidad_bultos":364,"clase_bultos":"Sacos","pais_origen":"SV","peso_bruto_kg":18200}]'::jsonb,
     '[{"pais":"SV","aduana":"El Amatillo"},{"pais":"HN","aduana":"El Amatillo"},{"pais":"NI","aduana":"Peñas Blancas"}]'::jsonb,
     38600.00, 1544.00, 386.00,
     now()-interval '4 days', NULL, now()-interval '5 days'),

    -- DUCA draft: FF1 conf1 GT→HN (aún llenando el wizard)
    (tx_f1_conf1, v_ff1, 'draft', NULL,
     'GT','HN','El Florido',NULL,
     'Express Cargo Guatemala S.A.','NIT','CF12345-6','GT',
     NULL, NULL, NULL, NULL,
     'Transportes Rápidos GT','P-55555',
     'Pedro',NULL,NULL,NULL,NULL,NULL,
     '[{"codigo_sac":"6204.42.00","descripcion":"Ropa femenina temporada verano","cantidad_bultos":520,"clase_bultos":"Cajas","pais_origen":"GT","peso_bruto_kg":5200}]'::jsonb,
     '[]'::jsonb,
     38900.00, NULL, NULL,
     NULL, NULL, now()-interval '1 day');

  -- ══════════════════════════════════════════════════════════════════════════
  -- LOAD APPLICATIONS — carriers postulándose al marketplace
  -- ══════════════════════════════════════════════════════════════════════════

  INSERT INTO load_applications (transaction_id, carrier_user_id, status, notes, created_at)
  VALUES
    -- FF1 pub1 (GT→MX café verde)
    (tx_f1_pub1, v_c4, 'pending',
     'Tengo disponibilidad inmediata. Hago regularmente la ruta GT-MX. Camión refrigerado disponible.',
     now()-interval '3 hours'),
    (tx_f1_pub1, v_c1, 'pending',
     'Regresando de Honduras con camión vacío. Puedo recoger en 24 horas en Antigua.',
     now()-interval '1 hour'),

    -- FF2 pub1 (SV→MX piñas)
    (tx_f2_pub1, v_c5, 'pending',
     'Disponible desde Managua. Puedo llegar a Acajutla en 2 días.',
     now()-interval '30 minutes');

  RAISE NOTICE 'Migration 009 completada: 9 cuentas demo, 18 transacciones, tracking events, DUCAs y QuickPay.';
  RAISE NOTICE 'Credenciales: *@porterra.app / Demo2026!';

END $$;
