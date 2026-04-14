'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'
import { hashField, encryptField } from '@/lib/crypto'
import { LoginSchema, RegisterFfSchema, RegisterCarrierSchema } from '@/lib/validations/auth'
import type { UserRole } from '@/types/database.types'

// Helper: admin client con any para evitar conflictos de tipos con Supabase generics
// Los tipos reales vienen de la DB una vez conectada
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return getAdminClient() as any }

// ─── LOGIN ────────────────────────────────────────────────────────────────────

export async function loginAction(formData: FormData) {
  const parsed = LoginSchema.safeParse({
    email:    formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? 'unknown'
  const ua = headersList.get('user-agent') ?? 'unknown'

  const { data, error } = await supabase.auth.signInWithPassword({
    email:    parsed.data.email,
    password: parsed.data.password,
  })

  if (error || !data.user) {
    // ⛔ No revelar si el email existe — respuesta genérica
    await logAuditEvent({
      actorUserId:    'anonymous',
      actorRole:      'carrier',
      actorIp:        ip,
      actorUserAgent: ua,
      eventType:      'auth.login.failed',
      metadata:       { email: parsed.data.email, reason: 'invalid_credentials' },
    })
    return { error: 'Email o contraseña incorrectos' }
  }

  const role: UserRole = (data.user.app_metadata?.porterra_role as UserRole) ?? 'carrier'

  await logAuditEvent({
    actorUserId:    data.user.id,
    actorRole:      role,
    actorIp:        ip,
    actorUserAgent: ua,
    eventType:      'auth.login.success',
    entityType:     'user',
    entityId:       data.user.id,
  })

  const roleRedirect: Record<UserRole, string> = {
    admin:             '/admin',
    freight_forwarder: '/ff',
    carrier:           '/carrier',
  }

  redirect(roleRedirect[role] ?? '/login')
}

// ─── REGISTER FF ──────────────────────────────────────────────────────────────

export async function registerFfAction(formData: FormData) {
  const raw = Object.fromEntries(formData)
  const parsed = RegisterFfSchema.safeParse(raw)

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString()
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
    }
    // Devolver campos (sin contraseña) para preservar lo ingresado
    const { password, confirmPassword, ...safeFields } = raw as Record<string, string>
    void password; void confirmPassword
    return { error: '', fieldErrors, fields: safeFields }
  }

  const admin       = getAdminClient()
  const headersList = await headers()
  const ip          = headersList.get('x-forwarded-for') ?? 'unknown'
  const ua          = headersList.get('user-agent') ?? 'unknown'

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:         parsed.data.email,
    password:      parsed.data.password,
    email_confirm: true,
    app_metadata: {
      porterra_role:      'freight_forwarder',
      porterra_status:    'pending',
      porterra_entity_id: null,
    },
  })

  if (authError || !authData.user) {
    if (authError?.message?.includes('already registered')) {
      return { error: '', fieldErrors: { email: 'Este email ya está registrado' }, fields: {} }
    }
    return { error: 'Error al crear la cuenta. Intenta de nuevo.', fieldErrors: {}, fields: {} }
  }

  const userId = authData.user.id

  const { data: ffProfile, error: ffError } = await db()
    .from('ff_profiles')
    .insert({
      user_id:       userId,
      company_name:  parsed.data.company_name,
      country:       parsed.data.company_country,
      contact_email: parsed.data.email,
      contact_phone: parsed.data.phone || null,
    })
    .select('id')
    .single()

  if (ffError || !ffProfile) {
    await admin.auth.admin.deleteUser(userId)
    return { error: 'Error al crear el perfil. Intenta de nuevo.', fieldErrors: {}, fields: {} }
  }

  const { error: profileError } = await db()
    .from('profiles')
    .insert({
      user_id:            userId,
      porterra_role:      'freight_forwarder',
      porterra_status:    'pending',
      pii_full_name:      parsed.data.full_name,
      pii_phone:          parsed.data.phone || null,
      enc_tax_id:         encryptField(parsed.data.tax_id),
      hash_tax_id:        hashField(parsed.data.tax_id),
      company_name:       parsed.data.company_name,
      company_country:    parsed.data.company_country,
      porterra_entity_id: ffProfile.id,
    })

  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: 'Error al crear el perfil. Intenta de nuevo.', fieldErrors: {}, fields: {} }
  }

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      porterra_role:      'freight_forwarder',
      porterra_status:    'pending',
      porterra_entity_id: ffProfile.id,
    },
  })

  await logAuditEvent({
    actorUserId:    userId,
    actorRole:      'freight_forwarder',
    actorIp:        ip,
    actorUserAgent: ua,
    eventType:      'user.profile.created',
    entityType:     'user',
    entityId:       userId,
    metadata:       { company: parsed.data.company_name, country: parsed.data.company_country },
  })

  // Iniciar sesión automáticamente para que el middleware no bloquee /pending
  const supabase = await createClient()
  await supabase.auth.signInWithPassword({
    email:    parsed.data.email,
    password: parsed.data.password,
  })

  redirect('/pending')
}

// ─── REGISTER CARRIER ─────────────────────────────────────────────────────────

export async function registerCarrierAction(formData: FormData) {
  const raw = Object.fromEntries(formData)
  const parsed = RegisterCarrierSchema.safeParse(raw)

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString()
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
    }
    const { password, confirmPassword, ...safeFields } = raw as Record<string, string>
    void password; void confirmPassword
    return { error: '', fieldErrors, fields: safeFields }
  }

  const admin       = getAdminClient()
  const headersList = await headers()
  const ip          = headersList.get('x-forwarded-for') ?? 'unknown'
  const ua          = headersList.get('user-agent') ?? 'unknown'

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:         parsed.data.email,
    password:      parsed.data.password,
    email_confirm: true,
    app_metadata: {
      porterra_role:      'carrier',
      porterra_status:    'pending',
      porterra_entity_id: null,
    },
  })

  if (authError || !authData.user) {
    if (authError?.message?.includes('already registered')) {
      return { error: '', fieldErrors: { email: 'Este email ya está registrado' }, fields: {} }
    }
    return { error: 'Error al crear la cuenta. Intenta de nuevo.', fieldErrors: {}, fields: {} }
  }

  const userId = authData.user.id

  const { data: carrierProfile, error: carrierError } = await db()
    .from('carrier_profiles')
    .insert({
      user_id:       userId,
      pii_full_name: parsed.data.full_name,
      contact_phone: parsed.data.phone,
      country:       parsed.data.country,
      vehicle_plate: parsed.data.vehicle_plate || null,
    })
    .select('id')
    .single()

  if (carrierError || !carrierProfile) {
    await admin.auth.admin.deleteUser(userId)
    return { error: 'Error al crear el perfil. Intenta de nuevo.', fieldErrors: {}, fields: {} }
  }

  const { error: profileError } = await db()
    .from('profiles')
    .insert({
      user_id:            userId,
      porterra_role:      'carrier',
      porterra_status:    'pending',
      pii_full_name:      parsed.data.full_name,
      pii_phone:          parsed.data.phone,
      company_country:    parsed.data.country,
      porterra_entity_id: carrierProfile.id,
    })

  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: 'Error al crear el perfil. Intenta de nuevo.', fieldErrors: {}, fields: {} }
  }

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      porterra_role:      'carrier',
      porterra_status:    'pending',
      porterra_entity_id: carrierProfile.id,
    },
  })

  await logAuditEvent({
    actorUserId:    userId,
    actorRole:      'carrier',
    actorIp:        ip,
    actorUserAgent: ua,
    eventType:      'user.profile.created',
    entityType:     'user',
    entityId:       userId,
    metadata:       { country: parsed.data.country },
  })

  // Iniciar sesión automáticamente para que el middleware no bloquee /pending
  const supabase = await createClient()
  await supabase.auth.signInWithPassword({
    email:    parsed.data.email,
    password: parsed.data.password,
  })

  redirect('/pending')
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
