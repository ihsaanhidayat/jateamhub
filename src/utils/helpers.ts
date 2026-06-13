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

// Low-res Google fallback (kept for the fallback chain).
export const getFaviconUrl = (url: string, size = 128): string => {
  const domain = getDomainFromUrl(url)
  if (!domain) return ''
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
}

// Ordered, high→low quality favicon sources. AppIcon walks this list,
// advancing on each <img> error, before falling back to its generic SVG.
export const getFaviconSources = (url: string): string[] => {
  const domain = getDomainFromUrl(url)
  if (!domain) return []
  return [
    `https://icon.horse/icon/${domain}`,                          // crisp, real site icons
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, // robust fallback
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,             // last resort
  ]
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
