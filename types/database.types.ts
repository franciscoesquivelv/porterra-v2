// ─────────────────────────────────────────────────────────────────────────────
// PORTERRA V2 — Database Types
// Generated from security & architecture docs
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'freight_forwarder' | 'carrier'
export type UserStatus = 'pending' | 'active' | 'suspended' | 'rejected'
export type KycStatus = 'not_started' | 'submitted' | 'approved' | 'rejected'
export type TransactionStatus = 'draft' | 'processing' | 'completed' | 'cancelled' | 'disputed'
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'reversed'
export type FactoringStatus = 'requested' | 'in_review' | 'approved' | 'disbursed' | 'settled' | 'overdue' | 'written_off'
export type DocumentType = 'BL' | 'invoice' | 'packing_list' | 'certificate' | 'other'
export type DucaStatus = 'draft' | 'sent' | 'approved'
export type DucaType = 'DUCA-T' | 'DUCA-F'
export type AlertLevel = 'info' | 'warning' | 'critical'
export type Country = 'GT' | 'HN' | 'SV' | 'NI' | 'CR' | 'PA' | 'MX'
export type CargoType = 'general' | 'refrigerated' | 'dangerous' | 'oversized'

// ─── PROFILES ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  user_id: string
  porterra_role: UserRole
  porterra_status: UserStatus
  kyc_status: KycStatus
  // pii_ prefix = Personally Identifiable Information
  pii_full_name: string
  pii_phone: string | null
  // enc_ prefix = AES-256 encrypted at rest
  enc_tax_id: string | null
  // hash_ prefix = hashed for lookup without decryption
  hash_tax_id: string | null
  company_name: string | null
  company_country: Country | null
  porterra_entity_id: string | null  // FK to ff_profiles or carrier_profiles
  avatar_url: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface FfProfile {
  id: string
  user_id: string
  company_name: string
  country: Country
  contact_email: string
  contact_phone: string | null
  is_verified: boolean
  verification_date: string | null
  credit_limit_usd: number
  metadata: Record<string, unknown>
  created_at: string
}

export interface CarrierProfile {
  id: string
  user_id: string
  pii_full_name: string
  enc_id_document: string | null
  contact_phone: string
  whatsapp_enabled: boolean
  country: Country
  vehicle_type: string | null
  vehicle_plate: string | null
  is_verified: boolean
  credit_score: number | null
  metadata: Record<string, unknown>
  created_at: string
}

// ─── SESSIONS ─────────────────────────────────────────────────────────────────

export interface Session {
  id: string
  user_id: string
  device_fingerprint: string
  ip_address: string
  user_agent: string
  last_seen_at: string
  expires_at: string
  is_active: boolean
  created_at: string
}

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  created_at: string
  actor_user_id: string | null
  actor_role: UserRole
  actor_ip: string | null
  actor_user_agent: string | null
  event_type: AuditEventType
  event_category: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown>
  checksum: string
}

export type AuditEventType =
  | 'auth.session.created'
  | 'auth.session.expired'
  | 'auth.login.failed'
  | 'auth.login.success'
  | 'auth.password.changed'
  | 'auth.mfa.enabled'
  | 'user.profile.created'
  | 'user.profile.updated'
  | 'user.kyc.submitted'
  | 'user.kyc.approved'
  | 'user.kyc.rejected'
  | 'user.account.suspended'
  | 'user.account.activated'
  | 'transaction.created'
  | 'transaction.status_changed'
  | 'transaction.cancelled'
  | 'transaction.completed'
  | 'payment.split.created'
  | 'payment.split.released'
  | 'payment.split.failed'
  | 'factoring.requested'
  | 'factoring.approved'
  | 'factoring.disbursed'
  | 'factoring.repaid'
  | 'admin.config.changed'
  | 'admin.user.approved'
  | 'admin.user.rejected'
  | 'admin.user.suspended'
  | 'document.duca.generated'
  | 'document.duca.sent'

// ─── PLATFORM CONFIG ──────────────────────────────────────────────────────────

export interface PlatformConfig {
  id: string
  key: string
  value: string
  description: string | null
  updated_by: string | null
  updated_at: string
}

// ─── JWT CUSTOM CLAIMS ────────────────────────────────────────────────────────

export interface PorterraJwtClaims {
  sub: string
  email: string
  role: 'authenticated'
  app_metadata: {
    porterra_role: UserRole
    porterra_status: UserStatus
    porterra_entity_id: string | null
  }
  iat: number
  exp: number
}

// ─── SUPABASE DATABASE TYPE MAP ───────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'user_id' | 'created_at'>>
      }
      ff_profiles: {
        Row: FfProfile
        Insert: Omit<FfProfile, 'id' | 'created_at'>
        Update: Partial<Omit<FfProfile, 'id' | 'user_id' | 'created_at'>>
      }
      carrier_profiles: {
        Row: CarrierProfile
        Insert: Omit<CarrierProfile, 'id' | 'created_at'>
        Update: Partial<Omit<CarrierProfile, 'id' | 'user_id' | 'created_at'>>
      }
      audit_log: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id'>
        Update: never  // Immutable — triggers block UPDATE
      }
      platform_config: {
        Row: PlatformConfig
        Insert: Omit<PlatformConfig, 'id'>
        Update: Partial<Omit<PlatformConfig, 'id'>>
      }
      sessions: {
        Row: Session
        Insert: Omit<Session, 'id' | 'created_at'>
        Update: Partial<Pick<Session, 'last_seen_at' | 'is_active'>>
      }
    }
    Enums: {
      user_role: UserRole
      user_status: UserStatus
      kyc_status: KycStatus
      transaction_status: TransactionStatus
      payment_status: PaymentStatus
      factoring_status: FactoringStatus
      document_type: DocumentType
      country: Country
      cargo_type: CargoType
    }
  }
}
