// ─────────────────────────────────────────────────────────────────────────────
// PORTERRA V2 — Field Encryption (AES-256-GCM)
// Para campos con prefijo enc_ en la base de datos
// ⛔ SOLO usar en Server Actions / Route Handlers — nunca en el cliente
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12   // 96 bits para GCM
const TAG_LENGTH = 16  // 128 bits auth tag

function getKey(): Buffer {
  const keyHex = process.env.FIELD_ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('FIELD_ENCRYPTION_KEY debe ser un hex de 64 caracteres (32 bytes)')
  }
  return Buffer.from(keyHex, 'hex')
}

/**
 * Cifra un string con AES-256-GCM.
 * Formato de salida: base64(nonce[12] + ciphertext + authTag[16])
 */
export function encryptField(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGO, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return Buffer.concat([iv, encrypted, tag]).toString('base64')
}

/**
 * Descifra un campo cifrado con encryptField.
 * Soporta rotación de claves: intenta con la clave actual, luego con la anterior.
 */
export function decryptField(encoded: string): string {
  const combined = Buffer.from(encoded, 'base64')
  const iv         = combined.subarray(0, IV_LENGTH)
  const tag        = combined.subarray(combined.length - TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH)

  // Intentar con clave actual
  try {
    const key = getKey()
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    // Intentar con clave anterior (rotación de claves)
    const prevKeyHex = process.env.FIELD_ENCRYPTION_KEY_PREV
    if (prevKeyHex && prevKeyHex.length === 64) {
      const prevKey = Buffer.from(prevKeyHex, 'hex')
      const decipher = createDecipheriv(ALGO, prevKey, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    }
    throw new Error('No se pudo descifrar el campo: ninguna clave disponible funcionó')
  }
}

/**
 * Hash SHA-256 para campos hash_ (búsqueda sin descifrar).
 * Incluye un salt fijo del sistema para prevenir rainbow tables.
 */
export function hashField(value: string): string {
  const salt = process.env.FIELD_ENCRYPTION_KEY?.slice(0, 32) ?? 'porterra-default-salt'
  return createHash('sha256')
    .update(salt + value.toLowerCase().trim())
    .digest('hex')
}
