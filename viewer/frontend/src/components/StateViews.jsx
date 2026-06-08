import React from 'react'

const centered = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  color: 'var(--color-text-secondary)',
  textAlign: 'center',
  gap: '12px',
}

export function LoadingSpinner({ size = 32 }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      style={{ animation: 'spin 1s linear infinite' }}
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="2"
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  )
}

export function IndexingScreen() {
  return (
    <div style={{ ...centered, minHeight: '100vh', background: 'var(--color-bg)' }}>
      <LoadingSpinner size={48} />
      <p style={{ fontSize: '16px', fontWeight: 500 }}>Building search index…</p>
      <p style={{ fontSize: '13px' }}>This may take a minute for large corpora</p>
    </div>
  )
}

function EmptyMark() {
  return (
    <span style={{
      display: 'inline-block', width: '30px', height: '30px',
      border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius)',
    }} aria-hidden="true" />
  )
}

export function EmptySearch() {
  return (
    <div style={centered}>
      <EmptyMark />
      <p>Search for a variable name or codebook description to explore the corpus.</p>
    </div>
  )
}

export function NoResults({ query }) {
  return (
    <div style={centered}>
      <p>No variables found for <em>'{query}'</em>.</p>
      <p style={{ fontSize: '12px' }}>Try a shorter term or remove filters.</p>
    </div>
  )
}

export function ErrorBanner({ message }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: 'var(--color-surface-2)',
      color: 'var(--color-error)',
      border: '1px solid var(--color-border)',
      borderLeft: '3px solid var(--color-error)',
      borderRadius: 'var(--radius)',
      fontSize: '13px',
      margin: '8px 0',
    }}>
      Something went wrong: {message}. Try again or check the server logs.
    </div>
  )
}

export function NoPaperSelected() {
  return (
    <div style={centered}>
      <EmptyMark />
      <p>Select a paper to view details.</p>
    </div>
  )
}
