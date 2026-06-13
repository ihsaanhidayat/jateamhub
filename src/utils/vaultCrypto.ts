// ============================================================
// Password Vault — recoverable client-side encryption.
//
//  · Master PIN → PBKDF2-SHA256 (200k) → AES-GCM 256 key.
//  · Vault entries (JSON) encrypted with that key → base64(iv ‖ ct),
//    stored in the widget section's items[0].desc and synced normally.
//  · vault_keys row holds ONLY { salt, iv, verifier }: the salt to
//    re-derive the same key anywhere, and an encrypted known token so a
//    wrong PIN is detected without exposing key material.
//  · Key lives in memory only; cleared on lock/logout.
// ============================================================
import { supabase } from './supabaseClient'
import type { VaultEntry } from '../types'

const PBKDF2_ITERS = 200_000
const VERIFIER_TOKEN = 'jateamhub-vault-ok'
const txt  = new TextEncoder()
const dtxt = new TextDecoder()

let _vaultKey: CryptoKey | null = null   // in-memory AES-GCM key after unlock
let _userId   = ''

// ── base64 helpers ────────────────────────────────────────────
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

export function isVaultUnlocked(): boolean { return !!_vaultKey }
export function clearVaultSession() { _vaultKey = null; _userId = '' }

async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', txt.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  )
}

async function encWithKey(key: CryptoKey, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, txt.encode(plain))
  const packed = new Uint8Array(iv.length + ct.byteLength)
  packed.set(iv, 0); packed.set(new Uint8Array(ct), iv.length)
  return abToB64(packed.buffer)
}

async function decWithKey(key: CryptoKey, payload: string): Promise<string> {
  const raw = b64ToBytes(payload)
  const iv  = raw.slice(0, 12)
  const ct  = raw.slice(12)
  const pt  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return dtxt.decode(pt)
}

// True once a vault master PIN has been provisioned for this user.
export async function vaultExists(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const { data } = await supabase.from('vault_keys').select('user_id').eq('user_id', session.user.id).maybeSingle()
  return !!data
}

// Wipe the vault for the current user (forgot-PIN reset). The encrypted
// entries become unrecoverable — this is wipe-only by design.
export async function resetVault(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return false
    await supabase.from('vault_keys').delete().eq('user_id', session.user.id)
    clearVaultSession()
    return true
  } catch (e) {
    console.warn('resetVault failed', e); return false
  }
}

// First-time setup: derive the key from the new PIN and escrow {salt,iv,verifier}.
export async function createVault(pin: string): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return false
    _userId = session.user.id
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key  = await deriveKey(pin, salt)
    const iv   = crypto.getRandomValues(new Uint8Array(12))
    const ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, txt.encode(VERIFIER_TOKEN))
    const { error } = await supabase.from('vault_keys').upsert({
      user_id:    _userId,
      salt:       abToB64(salt.buffer),
      iv:         abToB64(iv.buffer),
      verifier:   abToB64(ct),
      updated_at: new Date().toISOString(),
    })
    if (error) { console.warn('createVault upsert failed', error); return false }
    _vaultKey = key
    return true
  } catch (e) {
    console.warn('createVault failed', e); return false
  }
}

// Unlock: re-derive the key from the PIN + stored salt, verify against the
// escrowed verifier. Returns false on a wrong PIN (decrypt throws).
export async function unlockVault(pin: string): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return false
    _userId = session.user.id
    const { data } = await supabase
      .from('vault_keys').select('salt,iv,verifier').eq('user_id', _userId).maybeSingle()
    if (!data) return false
    const key = await deriveKey(pin, b64ToBytes(data.salt))
    // The verifier was encrypted with a SEPARATE iv (stored in data.iv), not the
    // packed iv‖ct format — decrypt with that iv. (Mismatch here was the bug that
    // rejected the correct PIN.) Throws on a wrong PIN.
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(data.iv) }, key, b64ToBytes(data.verifier))
    if (dtxt.decode(pt) !== VERIFIER_TOKEN) return false
    _vaultKey = key
    return true
  } catch {
    _vaultKey = null
    return false
  }
}

// Encrypt the full entry list for storage in the section desc.
export async function encryptVault(entries: VaultEntry[]): Promise<string> {
  if (!_vaultKey) throw new Error('vault locked')
  return encWithKey(_vaultKey, JSON.stringify(entries))
}

// Decrypt the section desc back into entries. Empty/blank → [].
export async function decryptVault(blob: string): Promise<VaultEntry[]> {
  if (!_vaultKey) throw new Error('vault locked')
  if (!blob || !blob.trim()) return []
  try {
    const json = await decWithKey(_vaultKey, blob)
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}
