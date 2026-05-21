import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', padding: 32,
        background: 'var(--bg)', fontFamily: 'var(--font)',
        gap: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--silver)', margin: 0 }}>
          Terjadi Kesalahan
        </h2>
        <p style={{
          fontSize: 13, color: 'var(--silver3)', maxWidth: 360,
          lineHeight: 1.6, margin: 0,
        }}>
          Bagian ini mengalami error. Coba refresh halaman atau hubungi admin jika masalah berlanjut.
        </p>
        <div style={{
          padding: '8px 14px', background: 'var(--bg2)',
          border: '1px solid var(--border)', borderRadius: 8,
          fontSize: 11, color: 'var(--silver3)',
          fontFamily: 'var(--mono)', maxWidth: 400,
          wordBreak: 'break-all', textAlign: 'left',
        }}>
          {this.state.error.message}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            height: 40, padding: '0 24px',
            background: 'var(--accent)', border: 'none',
            borderRadius: 8, color: 'white',
            fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>
          🔄 Refresh Halaman
        </button>
      </div>
    )
  }
}
