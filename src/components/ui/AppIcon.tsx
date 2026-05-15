import { useState } from 'react'
import { getFaviconUrl, isValidUrl } from '../../utils/helpers'
import type { LinkItem, IconSize } from '../../types'
import { ICON_SIZE_MAP } from '../../types'

interface Props {
  item: LinkItem
  iconSize: IconSize
  faviconEnabled: boolean
  className?: string
}

export default function AppIcon({ item, iconSize, faviconEnabled, className }: Props) {
  const [faviconError, setFaviconError] = useState(false)
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

  // 3. Favicon (if enabled and URL is valid)
  const shouldFavicon = (faviconEnabled || item.useFavicon) && isValidUrl(item.url) && !faviconError
  if (shouldFavicon) {
    const faviconUrl = getFaviconUrl(item.url, 64)
    return (
      <div style={wrapStyle} className={className}>
        <img
          src={faviconUrl}
          alt={item.title}
          style={imgStyle}
          onError={() => setFaviconError(true)}
          loading="lazy"
        />
      </div>
    )
  }

  // 4. Fallback: generic link icon SVG
  return (
    <div style={{ ...wrapStyle, background: 'var(--mint-bg)', border: '1px solid rgba(0,255,194,0.15)', borderRadius: 6 }} className={className}>
      <svg width={sizes.img * 0.65} height={sizes.img * 0.65} viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    </div>
  )
}
