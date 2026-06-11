// ============================================================
// Recoverable end-to-end encryption for chat.
//
//  · ECDH P-256 keypair per user.
//  · Private key wrapped with the chat PIN (PBKDF2 → AES-GCM) and
//    escrowed in `chat_keys` (owner-only). Recoverable on any device.
//  · Public key in profiles.chat_public_key.
//  · Per-conversation AES-GCM key derived via ECDH(myPriv, partnerPub).
//  · Messages: base64(iv ‖ ciphertext) stored in content, is_encrypted=true.
//
// All key material lives only in memory after unlock; cleared on lock.
// Every operation fails soft — if keys aren't ready we fall back to
// plaintext so chat never breaks.
// ============================================================
import { supabase } from './supabaseClient'

const PBKDF2_ITERS = 200_000
const txt = new TextEncoder()
const dtxt = new TextDecoder()

let _privateKey: CryptoKey | null = null          // my ECDH private key (in-memory)
let _myUserId = ''
const _convKeys = new Map<string, CryptoKey>()    // conversationId → AES-GCM key
const _pubKeys  = new Map<string, CryptoKey>()    // userId → ECDH public key

// ── base64 <-> ArrayBuffer ────────────────────────────────────
function abToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}
function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function isEncryptionReady(): boolean { return !!_privateKey }

export function clearCryptoSession() {
  _privateKey = null
  _myUserId = ''
  _convKeys.clear()
  _pubKeys.clear()
}

async function deriveWrapKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', txt.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  )
}

// Generate a fresh keypair, wrap the private key with the PIN, and upload.
async function generateAndUpload(pin: string): Promise<void> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  const pubJwk  = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const privJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv   = crypto.getRandomValues(new Uint8Array(12))
  const wrapKey = await deriveWrapKey(pin, salt)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, txt.encode(JSON.stringify(privJwk)))

  await supabase.from('chat_keys').upsert({
    user_id:     _myUserId,
    privkey_enc: abToB64(ct),
    salt:        abToB64(salt.buffer),
    iv:          abToB64(iv.buffer),
    updated_at:  new Date().toISOString(),
  })
  await supabase.from('profiles').update({ chat_public_key: JSON.stringify(pubJwk) }).eq('id', _myUserId)

  // Re-import private as non-extractable for in-memory use.
  _privateKey = await crypto.subtle.importKey('jwk', privJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])
}

// Called right after the PIN is verified. Loads & unwraps the private key,
// or provisions a fresh keypair for first-time / legacy users.
export async function initKeysOnUnlock(pin: string): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return false
    _myUserId = session.user.id
    _convKeys.clear()
    _pubKeys.clear()

    const { data: row } = await supabase
      .from('chat_keys').select('privkey_enc,salt,iv').eq('user_id', _myUserId).maybeSingle()

    if (row?.privkey_enc) {
      const salt = b64ToBytes(row.salt)
      const iv   = b64ToBytes(row.iv)
      const wrapKey = await deriveWrapKey(pin, salt)
      const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrapKey, b64ToBytes(row.privkey_enc))
      const jwk = JSON.parse(dtxt.decode(ptBuf))
      _privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])
      return true
    }

    await generateAndUpload(pin)
    return true
  } catch (e) {
    // Wrong PIN (decrypt throws) or any failure → encryption stays off, chat falls back to plaintext.
    console.warn('initKeysOnUnlock failed; encryption disabled this session', e)
    _privateKey = null
    return false
  }
}

async function getPartnerPublicKey(userId: string): Promise<CryptoKey | null> {
  if (_pubKeys.has(userId)) return _pubKeys.get(userId)!
  const { data } = await supabase.from('profiles').select('chat_public_key').eq('id', userId).maybeSingle()
  if (!data?.chat_public_key) return null
  try {
    const jwk = JSON.parse(data.chat_public_key)
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
    _pubKeys.set(userId, key)
    return key
  } catch { return null }
}

// AES-GCM key shared by both participants of a conversation. null if not derivable.
export async function getConvKey(conversationId: string, partnerId: string): Promise<CryptoKey | null> {
  if (!_privateKey) return null
  if (_convKeys.has(conversationId)) return _convKeys.get(conversationId)!
  const pub = await getPartnerPublicKey(partnerId)
  if (!pub) return null
  try {
    const key = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: pub }, _privateKey,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
    )
    _convKeys.set(conversationId, key)
    return key
  } catch { return null }
}

export async function encryptText(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, txt.encode(text))
  const packed = new Uint8Array(iv.length + ct.byteLength)
  packed.set(iv, 0)
  packed.set(new Uint8Array(ct), iv.length)
  return abToB64(packed.buffer)
}

export async function decryptText(key: CryptoKey, payload: string): Promise<string> {
  const raw = b64ToBytes(payload)
  const iv  = raw.slice(0, 12)
  const ct  = raw.slice(12)
  const pt  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return dtxt.decode(pt)
}
