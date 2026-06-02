export default function DashboardSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      {/* Header skeleton */}
      <div style={{
        height: 68, background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
        marginBottom: 20,
      }}>
        <div className="skeleton" style={{ width: 120, height: 20, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 180, height: 12, borderRadius: 4, marginTop: 4 }} />
      </div>
      {/* Grid skeleton */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 100 + i * 15, height: 14, borderRadius: 4 }} />
            </div>
            <div style={{ padding: 8, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {Array(Math.min(i + 2, 5)).fill(0).map((_, j) => (
                <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10 }} />
                  <div className="skeleton" style={{ width: 36, height: 8, borderRadius: 3 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
