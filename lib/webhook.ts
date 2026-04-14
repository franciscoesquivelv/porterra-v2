// ─────────────────────────────────────────────────────────────────────────────
// PORTERRA V2 — Webhook HMAC Validation
// Para validar webhooks de PSP (Kushki/dLocal) y KYC (Truora)
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Valida la firma HMAC de un webhook.
 * Usa timingSafeEqual para prevenir timing attacks.
 * ⛔ NUNCA usar === para comparar firmas HMAC
 */
export function validateWebhookSignature(
  rawBody: Buffer,
  receivedSignature: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): boolean {
  const expectedSig = createHmac(algorithm, secret)
    .update(rawBody)
    .digest('hex')

  const sigBuffer      = Buffer.from(receivedSignature.replace(`${algorithm}=`, ''))
  const expectedBuffer = Buffer.from(expectedSig)

  if (sigBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(sigBuffer, expectedBuffer)
}

/**
 * Lee el raw body de un Request para validación HMAC.
 * Debe llamarse ANTES de parsear el JSON.
 */
export async function getRawBody(request: Request): Promise<Buffer> {
  const arrayBuffer = await request.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
