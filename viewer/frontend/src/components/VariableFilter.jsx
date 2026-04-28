import React from 'react'

export default function VariableFilter({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
      <input
        type="search"
        placeholder="Filter by name or description…"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          flex: 1,
          padding: '6px 10px',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          fontSize: '13px',
          background: 'var(--color-bg)',
          color: 'var(--color-text-primary)',
          outline: 'none',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-focus)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            fontSize: '12px',
            padding: '4px 8px',
          }}
        >
          Clear
        </button>
      )}
    </div>
  )
}
