// Skema URL yang berbahaya
const BLOCKED_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:']

/**
 * Validasi URL — return true kalau aman
 */
export const isSafeUrl = (url: string): boolean => {
  if (!url || url === '#') return true
  const lower = url.toLowerCase().trim()
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) return false
  }
  // Block protocol-relative URLs like //evil.com
  if (lower.startsWith('//')) return false
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    // Relative path or anchor — safe (but not protocol-relative)
    return (url.startsWith('/') && !url.startsWith('//')) ||
           url.startsWith('#') || url.startsWith('.')
  }
}

/**
 * Sanitize URL — kembalikan '#' kalau berbahaya
 */
export const sanitizeUrl = (url: string): string => {
  if (!url) return '#'
  return isSafeUrl(url) ? url : '#'
}

/**
 * Validasi config JSON import
 */
export const validateImportConfig = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return 'Format tidak valid: bukan objek.'
  const d = data as Record<string, unknown>
  if (!Array.isArray(d.sections)) return 'Format tidak valid: sections harus berupa array.'
  if (d.sections.length === 0) return null // boleh kosong
  const firstSection = d.sections[0] as Record<string, unknown>
  if (!firstSection.id || !firstSection.title) return 'Format tidak valid: section harus punya id dan title.'
  return null // valid
}

/**
 * Cek apakah role valid — fallback ke 'user'
 */
export const sanitizeRole = (role: unknown): string => {
  const VALID_ROLES = ['superadmin', 'admin', 'user']
  if (typeof role === 'string' && VALID_ROLES.includes(role)) return role
  return 'user'
}

/**
 * Cek apakah pageId valid — fallback ke 'beranda'
 */
export const sanitizePage = (pageId: unknown, validPages: string[]): string => {
  if (typeof pageId === 'string' && validPages.includes(pageId)) return pageId
  return 'beranda'
}

/**
 * Hash PIN using PBKDF2-SHA256 (100k iterations) — returns base64 encoded hash
 */
export const hashPin = async (pin: string, salt: string): Promise<string> => {
  const enc  = new TextEncoder()
  const key  = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' },
    key, 256
  )
  const bytes = new Uint8Array(bits)
  let b = ''
  for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i])
  return btoa(b)
}

/**
 * Verify PIN against its stored PBKDF2 hash
 */
export const verifyPin = async (pin: string, salt: string, storedHash: string): Promise<boolean> => {
  try { return (await hashPin(pin, salt)) === storedHash }
  catch { return false }
}
