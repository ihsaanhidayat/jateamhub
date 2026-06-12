import React from 'react'

// Short one-line preview of a message (for reply banners / quoted blocks).
export function messagePreview(msg: {
  message_type: string; content: string | null; file_name?: string | null
}): string {
  switch (msg.message_type) {
    case 'image':    return msg.content ? `📷 ${msg.content}` : '📷 Foto'
    case 'video':    return msg.content ? `🎬 ${msg.content}` : '🎬 Video'
    case 'audio':    return '🎵 Pesan suara'
    case 'document': return '📎 ' + (msg.file_name ?? 'Dokumen')
    default:         return msg.content ?? ''
  }
}

// Turn URLs in a message into clickable links (keeps the rest as text).
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi

export function linkify(text: string): React.ReactNode {
  const parts = text.split(URL_RE)
  return parts.map((part, i) => {
    if (!part) return null
    if (/^(https?:\/\/|www\.)/i.test(part)) {
      const href = part.startsWith('http') ? part : `https://${part}`
      return React.createElement('a', {
        key: i, href, target: '_blank', rel: 'noreferrer',
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
        style: { color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' },
      }, part)
    }
    return React.createElement(React.Fragment, { key: i }, part)
  })
}

// Emoji, ZWJ, variation selector, skin-tone modifiers, regional indicators, whitespace.
const EMOJI_STRIP = /[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\s]/gu

// If a message is only emoji (≤ 3 graphemes), return that count so it can be
// rendered large with no bubble — otherwise 0.
export function emojiOnlyCount(text: string): number {
  const t = text.trim()
  if (!t) return 0
  if (t.replace(EMOJI_STRIP, '').length) return 0   // contains non-emoji
  try {
    const Seg = (Intl as any).Segmenter
    if (!Seg) return Array.from(t).length
    const seg = new Seg('id', { granularity: 'grapheme' })
    let n = 0
    for (const s of seg.segment(t) as Iterable<{ segment: string }>) if (s.segment.trim()) n++
    return n
  } catch {
    return Array.from(t).length
  }
}
