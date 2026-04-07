import React, { useState, useEffect } from 'react'
import { api } from './api/client'
import PapersView from './views/PapersView'
import VariablesView from './views/VariablesView'
import PipelineTransparencyPanel from './components/PipelineTransparencyPanel'
import Loading from './pages/Loading'
import { useTheme } from './hooks/useTheme'
import './styles/variables.css'

const headerStyle = {
  height: '56px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
  background: 'var(--color-surface)',
  borderBottom: '1px solid var(--color-border)',
  position: 'sticky',
  top: 0,
  zIndex: 100,
}

const tabStyle = (active) => ({
  padding: '0 16px',
  height: '56px',
  display: 'flex',
  alignItems: 'center',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: active ? 600 : 400,
  color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
  borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
})

export default function App() {
  const [indexed, setIndexed] = useState(false)
  const [tab, setTab] = useState('papers')
  const [stats, setStats] = useState(null)
  const [showPipeline, setShowPipeline] = useState(false)
  const { theme, toggle } = useTheme()

  // Poll health endpoint until indexed
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      while (!cancelled) {
        try {
          const h = await api.health()
          if (h.indexed) {
            if (!cancelled) setIndexed(true)
            return
          }
        } catch {
          // Not yet available — keep polling
        }
        await new Promise(r => setTimeout(r, 2000))
      }
    }
    poll()
    return () => { cancelled = true }
  }, [])

  // Load corpus stats once indexed
  useEffect(() => {
    if (!indexed) return
    api.corpusStats().then(setStats).catch(() => {})
  }, [indexed])

  if (!indexed) return <Loading />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, marginRight: '24px', color: 'var(--color-text-primary)' }}>
            PsychDS Viewer
          </span>
          <nav style={{ display: 'flex' }}>
            <button style={tabStyle(tab === 'papers')} onClick={() => setTab('papers')}>
              Papers
            </button>
            <button style={tabStyle(tab === 'variables')} onClick={() => setTab('variables')}>
              Variables
            </button>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {stats && (
            <span className="header-stats" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {stats.n_papers?.toLocaleString()} papers · {stats.n_variables?.toLocaleString()} variables · {stats.n_labelled_variables?.toLocaleString()} labelled
            </span>
          )}
          <button
            onClick={toggle}
            style={{
              background: 'none', border: '1px solid var(--color-border)',
              borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
              fontSize: '14px', color: 'var(--color-text-secondary)',
            }}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main>
        {tab === 'papers' ? <PapersView /> : <VariablesView />}
      </main>

      {/* Footer */}
      <footer style={{
        padding: '12px 24px',
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        fontSize: '12px',
        color: 'var(--color-text-muted)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
        <button
          onClick={() => setShowPipeline(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-accent)', fontSize: '12px',
          }}
        >
          ? About the Pipeline
        </button>
      </footer>

      {showPipeline && (
        <PipelineTransparencyPanel onClose={() => setShowPipeline(false)} />
      )}
    </div>
  )
}
