import React, { useState, useEffect } from 'react'
import { api } from './api/client'
import PapersView from './views/PapersView'
import VariablesView from './views/VariablesView'
import PipelineTransparencyPanel from './components/PipelineTransparencyPanel'
import HelpGlossary from './components/HelpGlossary'
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
  const [showHelp, setShowHelp] = useState(false)
  const [helpFirstVisit, setHelpFirstVisit] = useState(false)
  // Request to open a specific paper in the Papers view (from a variable result).
  // `key` forces re-trigger even when the same paper is opened twice.
  const [openPaperReq, setOpenPaperReq] = useState(null)
  const { theme, toggle } = useTheme()

  const handleOpenPaper = (paperId) => {
    setOpenPaperReq({ paperId, key: Date.now() })
    setTab('papers')
  }

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

  // Show the welcome/help guide automatically on a user's first visit.
  useEffect(() => {
    if (!indexed) return
    try {
      if (!localStorage.getItem('psychtrove_welcomed')) {
        setHelpFirstVisit(true)
        setShowHelp(true)
      }
    } catch { /* localStorage unavailable — skip */ }
  }, [indexed])

  const closeHelp = () => {
    setShowHelp(false)
    if (helpFirstVisit) {
      try { localStorage.setItem('psychtrove_welcomed', '1') } catch { /* ignore */ }
      setHelpFirstVisit(false)
    }
  }

  if (!indexed) return <Loading />

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ width: '3px', height: '20px', background: 'var(--color-accent)', marginRight: '9px' }} />
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.01em', color: 'var(--color-text-primary)' }}>
              PsychTrove
            </span>
          </span>
        </div>
        {/* Centered primary navigation — sits dead-center of the header regardless of side widths */}
        <nav style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px' }}>
          <button style={tabStyle(tab === 'papers')} onClick={() => setTab('papers')}>
            Repository search
          </button>
          <button style={tabStyle(tab === 'variables')} onClick={() => setTab('variables')}>
            Variable search
          </button>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {stats && (
            <span className="header-stats" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {stats.n_papers?.toLocaleString()} papers · {stats.n_variables?.toLocaleString()} variables · {stats.n_labelled_variables?.toLocaleString()} labelled
            </span>
          )}
          <button
            onClick={() => setShowHelp(true)}
            style={{
              background: 'none', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)', padding: '4px 12px', cursor: 'pointer',
              fontSize: '13px', color: 'var(--color-text-secondary)',
            }}
            title="How search works & glossary"
          >
            Help
          </button>
          <button
            onClick={toggle}
            style={{
              background: 'none', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)', padding: '4px 12px', cursor: 'pointer',
              fontSize: '13px', color: 'var(--color-text-secondary)',
            }}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
      </header>

      {/* Main content — flex child that owns its own scrolling */}
      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'papers'
          ? <PapersView openPaperReq={openPaperReq} />
          : <VariablesView onOpenPaper={handleOpenPaper} onShowHelp={() => setShowHelp(true)} />}
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
          About the pipeline
        </button>
      </footer>

      {showPipeline && (
        <PipelineTransparencyPanel onClose={() => setShowPipeline(false)} />
      )}

      {showHelp && (
        <HelpGlossary firstVisit={helpFirstVisit} onClose={closeHelp} />
      )}
    </div>
  )
}
