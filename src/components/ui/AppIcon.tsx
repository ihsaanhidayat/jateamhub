import { useState, memo } from 'react'
import { getFaviconSources, isValidUrl } from '../../utils/helpers'
import type { LinkItem, IconSize } from '../../types'
import { ICON_SIZE_MAP } from '../../types'

interface Props {
  item: LinkItem
  iconSize: IconSize
  faviconEnabled: boolean
  className?: string
}

export default memo(function AppIcon({ item, iconSize, faviconEnabled, className }: Props) {
  // Index into the favicon source chain; bumped on each load error.
  const [srcIdx, setSrcIdx] = useState(0)
  const sizes = ICON_SIZE_MAP[iconSize]

  const wrapStyle: React.CSSProperties = {
    width: sizes.wrapper,
    height: sizes.wrapper,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  const imgStyle: React.CSSProperties = {
    width: sizes.img,
    height: sizes.img,
    objectFit: 'contain',
    borderRadius: 4,
  }

  // Priority: iconUrl > favicon (if enabled) > emoji icon > fallback
  const isEmoji = item.icon && !item.icon.startsWith('http') && !item.icon.startsWith('/')

  // 1. Custom iconUrl
  if (item.iconUrl && isValidUrl(item.iconUrl)) {
    return (
      <div style={wrapStyle} className={className}>
        <img
          src={item.iconUrl}
          alt={item.title}
          style={imgStyle}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          loading="lazy"
        />
      </div>
    )
  }

  // 2. Emoji icon
  if (isEmoji) {
    return (
      <div style={{ ...wrapStyle, fontSize: sizes.img * 0.9 }} className={className}>
        {item.icon}
      </div>
    )
  }

  // 3. Favicon — walk a high→low quality source chain, advancing on error.
  const sources = (faviconEnabled || item.useFavicon) && isValidUrl(item.url) ? getFaviconSources(item.url) : []
  if (sources.length > 0 && srcIdx < sources.length) {
    return (
      <div style={wrapStyle} className={className}>
        <img
          key={srcIdx}
          src={sources[srcIdx]}
          alt={item.title}
          style={imgStyle}
          onError={() => setSrcIdx(i => i + 1)}
          onLoad={e => {
            // A 16×16 result usually means "no real icon" — try the next source.
            const img = e.target as HTMLImageElement
            if (img.naturalWidth <= 16 && img.naturalHeight <= 16) setSrcIdx(i => i + 1)
          }}
          loading="lazy"
        />
      </div>
    )
  }

  // 4. Fallback: generic link icon SVG
  return (
    <div style={{ ...wrapStyle, background: 'var(--accent-light)', border: '1px solid var(--border2)', borderRadius: 10 }} className={className}>
      <svg width={sizes.img * 0.6} height={sizes.img * 0.6} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    </div>
  )
})
