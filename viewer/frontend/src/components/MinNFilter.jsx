import React from 'react'

export default function MinNFilter({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
      <label htmlFor="min-n-input" style={{ color: 'var(--color-text-secondary)' }}>Min N:</label>
      <input
        id="min-n-input"
        type="number"
        min="0"
        placeholder="None"
        value={value ?? ''}
        onChange={e => onChange(e.target.value ? parseInt(e.target.value) : null)}
        style={{
          width: '80px',
          padding: '4px 8px',
          borderRadius: 'var(--radius)',
          fontSize: '12px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
          color: 'var(--color-text-primary)',
        }}
      />
    </div>
  )
}
