// Skeleton loader untuk loading state
export function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden', height: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 80, height: 12, borderRadius: 4 }} />
        <div style={{ marginLeft: 'auto' }}>
          <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4 }} />
        </div>
      </div>
      {/* Items */}
      <div style={{ padding: 8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 8 }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10 }} />
            <div className="skeleton" style={{ width: '80%', height: 10, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div style={{
      padding: 24, display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 16,
    }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ height: 200 + (i % 3) * 40, animation: `fadeIn 0.3s ease ${i * 80}ms both` }}>
          <SkeletonCard />
        </div>
      ))}
    </div>
  )
}
