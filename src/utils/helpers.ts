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

export const getFaviconUrl = (url: string, size = 64): string => {
  const domain = getDomainFromUrl(url)
  if (!domain) return ''
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
}

export const highlight = (text: string, query: string): string => {
  if (!query) return text
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(re, '<mark class="hl">$1</mark>')
}

export const isValidUrl = (url: string): boolean => {
  if (!url || url === '#') return false
  if (!isSafeUrl(url)) return false
  try { new URL(url); return true }
  catch { return false }
}
