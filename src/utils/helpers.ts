import { isSafeUrl } from './security'

export const uid = (): string => Math.random().toString(36).slice(2, 10)

export const getDomainFromUrl = (url: string): string => {
  try {
    if (!url || url === '#') return ''
    if (!isSafeUrl(url)) return ''
    const u = new URL(url)
    return u.hostname
  } catch { return '' }
}

export const getFaviconUrl = (url: string, _size = 64): string => {
  const domain = getDomainFromUrl(url)
  if (!domain) return ''
  // DuckDuckGo returns 404 for unknown domains so onError fires cleanly
  // (Google's s2/favicons returns a globe image instead of 404)
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`
}

export const highlight = (text: string, query: string): string => {
  // Escape HTML dulu sebelum inject — cegah XSS via item title
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
  if (!query) return escaped
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${safeQuery})`, 'gi')
  return escaped.replace(re, '<mark class="hl">$1</mark>')
}

export const isValidUrl = (url: string): boolean => {
  if (!url || url === '#') return false
  if (!isSafeUrl(url)) return false
  try { new URL(url); return true }
  catch { return false }
}
