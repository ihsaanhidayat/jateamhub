import { useState, memo } from 'react'
import { getFaviconSources, isValidUrl, gradientFor, getDomainFromUrl } from '../../utils/helpers'
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

  // 4. Fallback: a colorful gradient tile with the site's initial.
  const seed = getDomainFromUrl(item.url) || item.title || '?'
  const g = gradientFor(seed)
  const initial = (item.title?.trim()?.[0] || seed.replace(/^www\./, '')[0] || '?').toUpperCase()
  return (
    <div style={wrapStyle} className={className}>
      <div style={{
        width: sizes.wrapper, height: sizes.wrapper, borderRadius: '26%',
        background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: Math.round(sizes.wrapper * 0.5),
        lineHeight: 1, boxShadow: 'inset 0 1px 1px rgba(255,255,255,.25), 0 1px 3px rgba(0,0,0,.18)',
        fontFamily: 'var(--font)', userSelect: 'none',
      }}>{initial}</div>
    </div>
  )
})
