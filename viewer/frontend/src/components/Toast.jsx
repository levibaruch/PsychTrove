import React, { useEffect, useRef } from 'react'

export default function Toast({ message, onDismiss, autoDismissMs = 8000 }) {
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, autoDismissMs)
    return () => clearTimeout(timerRef.current)
  }, [onDismiss, autoDismissMs])

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 1000,
      maxWidth: '320px',
      fontSize: '13px',
    }}>
      <span>{message}</span>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          fontSize: '16px',
          lineHeight: 1,
          padding: '0 4px',
        }}
      >
        ✕
      </button>
    </div>
  )
}
