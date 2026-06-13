import { useState, useEffect } from 'react'
import { getLocation, type Loc } from '../../utils/location'

// Slim global footer — accurate (city-level) location at the bottom-right.
export default function AppFooter() {
  const [loc, setLoc] = useState<Loc | null>(null)
  useEffect(() => { let on = true; getLocation().then(l => { if (on) setLoc(l) }); return () => { on = false } }, [])

  return (
    <footer style={{
      position: 'sticky', bottom: 0, zIndex: 40, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '4px 16px', borderTop: '1px solid var(--border)',
      background: 'var(--bg2)', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--silver4)',
    }}>
      <span style={{ marginRight: 'auto', letterSpacing: '0.5px' }}>JATEAMHUB</span>
      {loc && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Lokasi perkiraan">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {loc.city}{loc.cc ? `, ${loc.cc}` : ''}
        </span>
      )}
    </footer>
  )
}
