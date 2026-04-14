// ─────────────────────────────────────────────────────────────────────────────
// PORTERRA V2 — Zod Validation Schemas: Auth (Zod v4 API)
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase().trim(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export const RegisterFfSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase().trim(),
  password: z
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
    .regex(/[0-9]/, 'Debe incluir al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial'),
  confirmPassword: z.string(),
  full_name: z.string().min(2, 'Nombre requerido').max(100).trim(),
  company_name: z.string().min(2, 'Nombre de empresa requerido').max(200).trim(),
  company_country: z.enum(['GT', 'HN', 'SV', 'NI', 'CR', 'PA', 'MX'] as const),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Teléfono inválido — incluye código de país')
    .optional()
    .or(z.literal('')),
  tax_id: z.string().min(5, 'RTN/NIT requerido').max(30).trim(),
  terms_accepted: z.literal('true'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

export const RegisterCarrierSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
    .regex(/[0-9]/, 'Debe incluir al menos un número'),
  confirmPassword: z.string(),
  full_name: z.string().min(2, 'Nombre requerido').max(100).trim(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Teléfono inválido — incluye código de país'),
  country: z.enum(['GT', 'HN', 'SV', 'NI', 'CR', 'PA', 'MX'] as const),
  vehicle_plate: z.string().max(20).optional().or(z.literal('')),
  terms_accepted: z.literal('true'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

export type LoginInput           = z.infer<typeof LoginSchema>
export type RegisterFfInput      = z.infer<typeof RegisterFfSchema>
export type RegisterCarrierInput = z.infer<typeof RegisterCarrierSchema>
