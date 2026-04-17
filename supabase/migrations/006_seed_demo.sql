-- ─────────────────────────────────────────────────────────────────────────────
-- PORTERRA V2 — Migration 006: Demo Seed Data
-- 15 transacciones realistas distribuidas en todos los estados del ciclo de vida
-- Visible en los tres perfiles: FF, Carrier y Admin
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_ff_id       uuid;
  v_carrier_id  uuid;
  v_admin_id    uuid;

  -- IDs de transacciones
  t_comp1  uuid := gen_random_uuid();
  t_comp2  uuid := gen_random_uuid();
  t_comp3  uuid := gen_random_uuid();
  t_comp4  uuid := gen_random_uuid();
  t_comp5  uuid := gen_random_uuid();
  t_tran1  uuid := gen_random_uuid();
  t_tran2  uuid := gen_random_uuid();
  t_deliv1 uuid := gen_random_uuid();
  t_conf1  uuid := gen_random_uuid();
  t_conf2  uuid := gen_random_uuid();
  t_pub1   uuid := gen_random_uuid();
  t_pub2   uuid := gen_random_uuid();
  t_draft1 uuid := gen_random_uuid();
  t_draft2 uuid := gen_random_uuid();
  t_cancel uuid := gen_random_uuid();

BEGIN
  -- ── Obtener IDs dinámicamente ───────────────────────────────────────────────
  SELECT user_id INTO v_ff_id
    FROM profiles WHERE porterra_role = 'freight_forwarder' LIMIT 1;

  SELECT user_id INTO v_carrier_id
    FROM profiles WHERE porterra_role = 'carrier' LIMIT 1;

  SELECT user_id INTO v_admin_id
    FROM profiles WHERE porterra_role = 'admin' LIMIT 1;

  IF v_ff_id IS NULL OR v_carrier_id IS NULL THEN
    RAISE EXCEPTION 'Necesitas al menos un FF y un Carrier registrados antes de correr el seed.';
  END IF;

  -- ── LIMPIAR datos previos del seed (idempotente) ────────────────────────────
  DELETE FROM tracking_events WHERE transaction_id IN (
    SELECT id FROM transactions WHERE ff_user_id = v_ff_id
  );
  DELETE FROM duca_documents  WHERE ff_user_id = v_ff_id;
  DELETE FROM payment_splits  WHERE carrier_user_id = v_carrier_id;
  DELETE FROM load_applications WHERE carrier_user_id = v_carrier_id;
  DELETE FROM transactions    WHERE ff_user_id = v_ff_id;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 1-5: TRANSACCIONES COMPLETADAS (historial)
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO transactions (id, ff_user_id, carrier_user_id, status,
    cargo_description, cargo_type, cargo_weight_kg,
    origin_country, destination_country,
    total_amount_usd, carrier_payout_usd,
    pickup_date, delivery_date, completed_at, created_at)
  VALUES
    -- 1. Textiles Guatemala → Honduras (88 días atrás)
    (t_comp1, v_ff_id, v_carrier_id, 'completed',
     'Textiles y confección — 240 cajas palletizadas', 'general', 8400,
     'GT', 'HN',
     45200.00, 36160.00,
     (now() - interval '90 days')::date,
     (now() - interval '88 days')::date,
     now() - interval '88 days',
     now() - interval '92 days'),

    -- 2. Alimentos Honduras → El Salvador (72 días atrás)
    (t_comp2, v_ff_id, v_carrier_id, 'completed',
     'Productos alimenticios secos — granos y cereales', 'general', 12600,
     'HN', 'SV',
     32800.00, 26240.00,
     (now() - interval '74 days')::date,
     (now() - interval '72 days')::date,
     now() - interval '72 days',
     now() - interval '76 days'),

    -- 3. Maquinaria agrícola El Salvador → Guatemala (57 días atrás)
    (t_comp3, v_ff_id, v_carrier_id, 'completed',
     'Maquinaria agrícola — tractores y repuestos', 'general', 18900,
     'SV', 'GT',
     78500.00, 62800.00,
     (now() - interval '60 days')::date,
     (now() - interval '57 days')::date,
     now() - interval '57 days',
     now() - interval '62 days'),

    -- 4. Productos farmacéuticos Guatemala → México (42 días atrás)
    (t_comp4, v_ff_id, v_carrier_id, 'completed',
     'Productos farmacéuticos — medicamentos de patente', 'general', 3200,
     'GT', 'MX',
     94600.00, 75680.00,
     (now() - interval '45 days')::date,
     (now() - interval '42 days')::date,
     now() - interval '42 days',
     now() - interval '47 days'),

    -- 5. Café y cacao Costa Rica → Panamá (27 días atrás)
    (t_comp5, v_ff_id, v_carrier_id, 'completed',
     'Café verde y cacao — sacos a granel certificados', 'general', 9800,
     'CR', 'PA',
     28400.00, 22720.00,
     (now() - interval '30 days')::date,
     (now() - interval '27 days')::date,
     now() - interval '27 days',
     now() - interval '32 days');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 6-7: EN TRÁNSITO
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO transactions (id, ff_user_id, carrier_user_id, status,
    cargo_description, cargo_type, cargo_weight_kg,
    origin_country, destination_country,
    total_amount_usd, carrier_payout_usd,
    pickup_date, delivery_date, created_at)
  VALUES
    -- 6. Materiales de construcción Honduras → Guatemala
    (t_tran1, v_ff_id, v_carrier_id, 'in_transit',
     'Materiales de construcción — cemento y varillas', 'general', 22000,
     'HN', 'GT',
     55000.00, 44000.00,
     (now() - interval '6 days')::date,
     (now() + interval '1 day')::date,
     now() - interval '8 days'),

    -- 7. Productos químicos Guatemala → El Salvador
    (t_tran2, v_ff_id, v_carrier_id, 'in_transit',
     'Insumos agroindustriales — fertilizantes líquidos', 'general', 14500,
     'GT', 'SV',
     41200.00, 32960.00,
     (now() - interval '3 days')::date,
     (now() + interval '2 days')::date,
     now() - interval '5 days');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 8: ENTREGADA (pendiente confirmación del FF)
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO transactions (id, ff_user_id, carrier_user_id, status,
    cargo_description, cargo_type, cargo_weight_kg,
    origin_country, destination_country,
    total_amount_usd, carrier_payout_usd,
    pickup_date, delivery_date, created_at)
  VALUES
    (t_deliv1, v_ff_id, v_carrier_id, 'delivered',
     'Electrodomésticos — línea blanca empacada', 'general', 7600,
     'SV', 'HN',
     67300.00, 53840.00,
     (now() - interval '5 days')::date,
     (now() - interval '1 day')::date,
     now() - interval '7 days');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 9-10: CONFIRMADAS (carrier asignado, pendiente recogida)
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO transactions (id, ff_user_id, carrier_user_id, status,
    cargo_description, cargo_type, cargo_weight_kg,
    origin_country, destination_country,
    total_amount_usd, carrier_payout_usd,
    pickup_date, delivery_date, created_at)
  VALUES
    (t_conf1, v_ff_id, v_carrier_id, 'confirmed',
     'Ropa y accesorios de moda — temporada alta', 'general', 5200,
     'GT', 'CR',
     38900.00, 31120.00,
     (now() + interval '1 day')::date,
     (now() + interval '4 days')::date,
     now() - interval '1 day'),

    (t_conf2, v_ff_id, v_carrier_id, 'confirmed',
     'Autopartes y refacciones — repuestos OEM', 'general', 11200,
     'MX', 'GT',
     52400.00, 41920.00,
     (now() + interval '2 days')::date,
     (now() + interval '5 days')::date,
     now() - interval '1 day');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 11-12: PUBLICADAS (en el marketplace, sin carrier)
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO transactions (id, ff_user_id, carrier_user_id, status,
    cargo_description, cargo_type, cargo_weight_kg,
    origin_country, destination_country,
    total_amount_usd, carrier_payout_usd,
    pickup_date, delivery_date, created_at)
  VALUES
    (t_pub1, v_ff_id, NULL, 'published',
     'Fertilizantes y agroquímicos — sacos 50kg paletizados', 'general', 16800,
     'HN', 'NI',
     29600.00, 23680.00,
     (now() + interval '3 days')::date,
     (now() + interval '6 days')::date,
     now()),

    (t_pub2, v_ff_id, NULL, 'published',
     'Madera aserrada y tableros MDF — carga granel', 'general', 19400,
     'GT', 'PA',
     44100.00, 35280.00,
     (now() + interval '4 days')::date,
     (now() + interval '8 days')::date,
     now());

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 13-14: BORRADORES
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO transactions (id, ff_user_id, status,
    cargo_description, cargo_type,
    origin_country, destination_country,
    total_amount_usd, carrier_payout_usd, created_at)
  VALUES
    (t_draft1, v_ff_id, 'draft',
     'Productos lácteos refrigerados — quesos y mantequilla', 'general',
     'SV', 'CR',
     18200.00, 14560.00,
     now()),

    (t_draft2, v_ff_id, 'draft',
     'Mercancía general — carga consolidada LCL', 'general',
     'GT', 'HN',
     24800.00, 19840.00,
     now());

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 15: CANCELADA
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO transactions (id, ff_user_id, carrier_user_id, status,
    cargo_description, cargo_type,
    origin_country, destination_country,
    total_amount_usd, carrier_payout_usd,
    cancelled_at, created_at)
  VALUES
    (t_cancel, v_ff_id, NULL, 'cancelled',
     'Materiales eléctricos — cables y tableros industriales', 'general',
     'NI', 'GT',
     33500.00, 26800.00,
     now() - interval '18 days',
     now() - interval '22 days');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PAYMENT SPLITS
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO payment_splits
    (transaction_id, carrier_user_id, split_label, amount_usd, split_percentage,
     status, due_date, released_at, paid_at, payment_method, created_at)
  VALUES
    -- Completadas: ambos splits PAGADOS
    (t_comp1, v_carrier_id, 'Anticipo 50%', 18080.00, 50, 'paid',
     (now()-interval '88 days')::date, now()-interval '88 days', now()-interval '87 days',
     'bank_transfer', now()-interval '90 days'),
    (t_comp1, v_carrier_id, 'Saldo final 50%', 18080.00, 50, 'paid',
     (now()-interval '86 days')::date, now()-interval '88 days', now()-interval '85 days',
     'bank_transfer', now()-interval '90 days'),

    (t_comp2, v_carrier_id, 'Anticipo 50%', 13120.00, 50, 'paid',
     (now()-interval '72 days')::date, now()-interval '72 days', now()-interval '71 days',
     'bank_transfer', now()-interval '74 days'),
    (t_comp2, v_carrier_id, 'Saldo final 50%', 13120.00, 50, 'paid',
     (now()-interval '70 days')::date, now()-interval '72 days', now()-interval '69 days',
     'bank_transfer', now()-interval '74 days'),

    (t_comp3, v_carrier_id, 'Anticipo 50%', 31400.00, 50, 'paid',
     (now()-interval '57 days')::date, now()-interval '57 days', now()-interval '56 days',
     'bank_transfer', now()-interval '60 days'),
    (t_comp3, v_carrier_id, 'Saldo final 50%', 31400.00, 50, 'paid',
     (now()-interval '55 days')::date, now()-interval '57 days', now()-interval '54 days',
     'bank_transfer', now()-interval '60 days'),

    (t_comp4, v_carrier_id, 'Anticipo 50%', 37840.00, 50, 'paid',
     (now()-interval '42 days')::date, now()-interval '42 days', now()-interval '41 days',
     'bank_transfer', now()-interval '45 days'),
    (t_comp4, v_carrier_id, 'Saldo final 50%', 37840.00, 50, 'paid',
     (now()-interval '40 days')::date, now()-interval '42 days', now()-interval '39 days',
     'bank_transfer', now()-interval '45 days'),

    (t_comp5, v_carrier_id, 'Anticipo 50%', 11360.00, 50, 'paid',
     (now()-interval '27 days')::date, now()-interval '27 days', now()-interval '26 days',
     'bank_transfer', now()-interval '30 days'),
    (t_comp5, v_carrier_id, 'Saldo final 50%', 11360.00, 50, 'paid',
     (now()-interval '25 days')::date, now()-interval '27 days', now()-interval '24 days',
     'bank_transfer', now()-interval '30 days'),

    -- En tránsito: anticipo LIBERADO, saldo PENDIENTE
    (t_tran1, v_carrier_id, 'Anticipo 50%', 22000.00, 50, 'released',
     now()::date, now()-interval '6 days', NULL,
     'porterra_wallet', now()-interval '8 days'),
    (t_tran1, v_carrier_id, 'Saldo final 50%', 22000.00, 50, 'pending',
     (now() + interval '3 days')::date, NULL, NULL,
     NULL, now()-interval '8 days'),

    (t_tran2, v_carrier_id, 'Anticipo 50%', 16480.00, 50, 'released',
     now()::date, now()-interval '3 days', NULL,
     'porterra_wallet', now()-interval '5 days'),
    (t_tran2, v_carrier_id, 'Saldo final 50%', 16480.00, 50, 'pending',
     (now() + interval '4 days')::date, NULL, NULL,
     NULL, now()-interval '5 days'),

    -- Entregada: anticipo liberado, saldo pendiente de confirmación
    (t_deliv1, v_carrier_id, 'Anticipo 50%', 26920.00, 50, 'released',
     (now()-interval '5 days')::date, now()-interval '5 days', NULL,
     'porterra_wallet', now()-interval '7 days'),
    (t_deliv1, v_carrier_id, 'Saldo final 50%', 26920.00, 50, 'pending',
     now()::date, NULL, NULL,
     NULL, now()-interval '7 days'),

    -- Confirmadas: ambos splits PENDIENTES
    (t_conf1, v_carrier_id, 'Anticipo 50%', 15560.00, 50, 'pending',
     (now() + interval '1 day')::date, NULL, NULL,
     NULL, now()-interval '1 day'),
    (t_conf1, v_carrier_id, 'Saldo final 50%', 15560.00, 50, 'pending',
     (now() + interval '7 days')::date, NULL, NULL,
     NULL, now()-interval '1 day'),

    (t_conf2, v_carrier_id, 'Anticipo 50%', 20960.00, 50, 'pending',
     (now() + interval '2 days')::date, NULL, NULL,
     NULL, now()-interval '1 day'),
    (t_conf2, v_carrier_id, 'Saldo final 50%', 20960.00, 50, 'pending',
     (now() + interval '8 days')::date, NULL, NULL,
     NULL, now()-interval '1 day');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TRACKING EVENTS — viajes activos y completados
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO tracking_events
    (transaction_id, event_type, country, location_name, notes, created_by, created_at)
  VALUES
    -- Completada 1 (GT→HN)
    (t_comp1, 'origin_pickup',            'GT', 'Bodega ZOLIC Zona Franca GT',
     'Carga recogida. 240 cajas en buen estado.',        v_carrier_id, now()-interval '90 days'),
    (t_comp1, 'border_approach',          'GT', 'Aduana El Florido',
     'Aproximando a frontera GT/HN.',                    v_carrier_id, now()-interval '89 days 6 hours'),
    (t_comp1, 'border_crossing_complete', 'HN', 'Aduana Agua Caliente',
     'Cruce completado sin incidencias.',                v_carrier_id, now()-interval '89 days'),
    (t_comp1, 'delivered',                'HN', 'Bodega cliente San Pedro Sula',
     'Entrega confirmada. Receptor: Carlos Membreño.',   v_carrier_id, now()-interval '88 days'),

    -- Completada 3 (SV→GT) — con más granularidad
    (t_comp3, 'origin_pickup',            'SV', 'Puerto Acajutla — muelle 3',
     'Carga de maquinaria recogida. 3 unidades.',        v_carrier_id, now()-interval '62 days'),
    (t_comp3, 'in_transit',               'SV', 'Autopista del Norte SV',
     'En ruta hacia frontera.',                          v_carrier_id, now()-interval '61 days 18 hours'),
    (t_comp3, 'border_crossing_start',    'GT', 'Aduana Pedro de Alvarado',
     'Iniciando trámite aduanero. DUCA presentada.',     v_carrier_id, now()-interval '61 days 10 hours'),
    (t_comp3, 'customs_cleared',          'GT', 'Aduana Pedro de Alvarado',
     'Aduana despachada. DUCA aprobada.',                v_carrier_id, now()-interval '61 days 6 hours'),
    (t_comp3, 'in_transit_destination',   'GT', 'CA-1 hacia Ciudad de Guatemala',
     'En ruta final al destino.',                        v_carrier_id, now()-interval '60 days 12 hours'),
    (t_comp3, 'delivered',                'GT', 'Bodega industrial Zona 12 GT',
     'Entrega completa. Maquinaria descargada OK.',      v_carrier_id, now()-interval '57 days'),

    -- En tránsito 1 (HN→GT)
    (t_tran1, 'origin_pickup',            'HN', 'Planta cementera San Pedro Sula',
     'Carga recogida. 22 toneladas cargadas.',           v_carrier_id, now()-interval '6 days'),
    (t_tran1, 'in_transit',               'HN', 'Carretera CA-5 Honduras',
     'En ruta hacia frontera El Florido.',               v_carrier_id, now()-interval '5 days 16 hours'),
    (t_tran1, 'border_crossing_start',    'GT', 'Aduana El Florido',
     'Presentando documentación. DUCA en revisión.',     v_carrier_id, now()-interval '5 days 10 hours'),
    (t_tran1, 'border_crossing_complete', 'GT', 'Aduana El Florido',
     'Cruce aprobado. Ingresando a Guatemala.',          v_carrier_id, now()-interval '5 days 6 hours'),
    (t_tran1, 'in_transit_destination',   'GT', 'CA-9 hacia Ciudad de Guatemala',
     'En ruta al destino final. ETA: mañana.',           v_carrier_id, now()-interval '4 days'),

    -- En tránsito 2 (GT→SV)
    (t_tran2, 'origin_pickup',            'GT', 'Bodega agroindustrial Villa Nueva GT',
     'Carga de fertilizantes recogida. Tanques sellados.',v_carrier_id, now()-interval '3 days'),
    (t_tran2, 'border_approach',          'GT', 'Aduana San Cristóbal Frontera',
     'Aproximando a aduana GT/SV.',                      v_carrier_id, now()-interval '2 days 12 hours'),
    (t_tran2, 'border_crossing_start',    'SV', 'Aduana Las Chinamas',
     'Trámite aduanero iniciado.',                       v_carrier_id, now()-interval '2 days 8 hours'),

    -- Entregada (SV→HN)
    (t_deliv1, 'origin_pickup',           'SV', 'Bodega Samsung El Salvador',
     'Línea blanca cargada. 76 pallets.',                v_carrier_id, now()-interval '5 days'),
    (t_deliv1, 'in_transit',              'SV', 'Autopista CA-1 rumbo norte',
     'En ruta hacia Honduras.',                          v_carrier_id, now()-interval '4 days 18 hours'),
    (t_deliv1, 'border_crossing_complete','HN', 'Aduana El Poy',
     'Cruce completado. Documentación OK.',              v_carrier_id, now()-interval '3 days'),
    (t_deliv1, 'delivered',               'HN', 'Tienda Tropigas San Pedro Sula',
     'Entrega realizada. 76/76 pallets. Firmado por Recepción.', v_carrier_id, now()-interval '1 day');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- DUCA DOCUMENTS
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO duca_documents (
    transaction_id, ff_user_id, status, duca_number,
    pais_procedencia, pais_destino,
    aduana_inicio, aduana_destino,
    exportador_nombre, exportador_tipo_doc, exportador_numero_doc,
    importador_nombre, importador_tipo_doc, importador_numero_doc,
    exportador_pais_emision, importador_pais_emision,
    mercancias, valor_transaccion, gastos_transporte, gastos_seguro,
    transportista_nombre, vehiculo_placa,
    conductor_primer_nombre, conductor_primer_apellido,
    conductor_tipo_doc, conductor_numero_doc, conductor_licencia,
    conductor_pais_exp,
    ruta_transito,
    submitted_at, approved_at, created_at)
  VALUES
    -- DUCA aprobada para t_comp1 (GT→HN)
    (t_comp1, v_ff_id, 'approved', 'DUCA-T-2026-00001',
     'GT', 'HN', 'El Florido', 'Agua Caliente',
     'Textiles Centroamérica S.A.', 'NIT', '1234567-8',
     'Distribuidora Tegus S. de R.L.', 'RTN', '05019999012345',
     'GT', 'HN',
     '[{"codigo_sac":"6109.10.00","descripcion":"Camisetas de algodón","cantidad_bultos":240,"clase_bultos":"Cajas","pais_origen":"GT","peso_bruto_kg":8400}]',
     45200.00, 1800.00, 450.00,
     'Transportes Rápidos del Norte', 'P-54321',
     'Miguel', 'Hernández', 'DUI', '05234567-8', 'TRAN-2024-GT-0045', 'GT',
     '[{"pais":"GT","aduana":"El Florido"},{"pais":"HN","aduana":"Agua Caliente"}]',
     now()-interval '91 days', now()-interval '90 days', now()-interval '92 days'),

    -- DUCA aprobada para t_comp3 (SV→GT)
    (t_comp3, v_ff_id, 'approved', 'DUCA-T-2026-00002',
     'SV', 'GT', 'Pedro de Alvarado', 'San Cristóbal',
     'Maquinaria Agrícola del Pacífico S.A. de C.V.', 'NIT', '0614-271190-102-3',
     'Agroindustrias Guatemala S.A.', 'NIT', '9876543-2',
     'SV', 'GT',
     '[{"codigo_sac":"8432.10.00","descripcion":"Tractores agrícolas","cantidad_bultos":3,"clase_bultos":"Unidades","pais_origen":"US","peso_bruto_kg":18900}]',
     78500.00, 3200.00, 785.00,
     'Transportes Rápidos del Norte', 'P-54321',
     'Miguel', 'Hernández', 'DUI', '05234567-8', 'TRAN-2024-GT-0045', 'GT',
     '[{"pais":"SV","aduana":"Pedro de Alvarado"},{"pais":"GT","aduana":"San Cristóbal"}]',
     now()-interval '63 days', now()-interval '62 days', now()-interval '64 days'),

    -- DUCA en tránsito para t_tran1 (HN→GT) — submitted, pendiente de aprobación
    (t_tran1, v_ff_id, 'submitted', NULL,
     'HN', 'GT', 'El Florido', 'El Florido',
     'Cementos del Norte S.A. de C.V.', 'RTN', '08019999056789',
     'Constructora Capital GT S.A.', 'NIT', '7654321-0',
     'HN', 'GT',
     '[{"codigo_sac":"2523.29.00","descripcion":"Cemento Portland","cantidad_bultos":440,"clase_bultos":"Sacos","pais_origen":"HN","peso_bruto_kg":22000}]',
     55000.00, 2200.00, 550.00,
     'Transportes Rápidos del Norte', 'P-54321',
     'Miguel', 'Hernández', 'DUI', '05234567-8', 'TRAN-2024-GT-0045', 'GT',
     '[{"pais":"HN","aduana":"El Florido"},{"pais":"GT","aduana":"El Florido"}]',
     now()-interval '7 days', NULL, now()-interval '8 days'),

    -- DUCA en borrador para t_conf1 (GT→CR)
    (t_conf1, v_ff_id, 'draft', NULL,
     'GT', 'CR', 'Peñas Blancas', 'Peñas Blancas',
     'Moda Centroamericana S.A.', 'NIT', '2345678-9',
     'Fashion Store Costa Rica S.A.', 'Cédula jurídica', '3-101-789456',
     'GT', 'CR',
     '[{"codigo_sac":"6204.42.00","descripcion":"Prendas de vestir femeninas","cantidad_bultos":520,"clase_bultos":"Cajas","pais_origen":"GT","peso_bruto_kg":5200}]',
     38900.00, 1950.00, 389.00,
     'Transportes Rápidos del Norte', 'P-54321',
     'Miguel', 'Hernández', 'DUI', '05234567-8', 'TRAN-2024-GT-0045', 'GT',
     '[{"pais":"GT","aduana":"Peñas Blancas"},{"pais":"NI","aduana":"Peñas Blancas"},{"pais":"CR","aduana":"Peñas Blancas"}]',
     NULL, NULL, now()-interval '1 day');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- LOAD APPLICATIONS — postulaciones a cargas publicadas
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO load_applications
    (transaction_id, carrier_user_id, status, notes, created_at)
  VALUES
    (t_pub1, v_carrier_id, 'pending',
     'Disponible desde mañana. Tengo experiencia en esta ruta HN→NI, la hago regularmente.',
     now() - interval '2 hours'),
    (t_pub2, v_carrier_id, 'pending',
     'Camión disponible. Puedo recoger en 48 horas.',
     now() - interval '1 hour');

  RAISE NOTICE 'Seed completado: 15 transacciones, % payment splits, tracking events y DUCAs insertados.',
    (SELECT COUNT(*) FROM payment_splits WHERE carrier_user_id = v_carrier_id);

END $$;
