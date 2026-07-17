import React, { Component, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Self-hosted variable fonts (bundled via Vite — no runtime CDN, offline-safe).
// Geist Sans + Geist Mono: Vercel's typeface family built for developer tools.
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import './globals.css'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e } }
  render() {
    if (this.state.error) {
      const e = this.state.error as Error
      return (
        <div style={{ padding: 32, color: '#f87171', fontFamily: 'monospace', background: 'var(--color-bg-base, #050810)', height: '100vh' }}>
          <h2 style={{ marginBottom: 12 }}>App crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{e.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, opacity: 0.6, marginTop: 8 }}>{e.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
