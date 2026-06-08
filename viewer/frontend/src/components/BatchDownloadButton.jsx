import React from 'react'

export default function BatchDownloadButton({ selectedCount, onDownload, disabled }) {
  return (
    <button
      disabled={disabled || selectedCount === 0}
      onClick={onDownload}
      style={{
        padding: '6px 12px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        cursor: disabled || selectedCount === 0 ? 'not-allowed' : 'pointer',
        fontSize: '12px',
        opacity: disabled || selectedCount === 0 ? 0.5 : 1,
        fontWeight: 500,
      }}
      title={selectedCount === 0 ? 'Select papers to download' : `Download selected ${selectedCount} paper${selectedCount === 1 ? '' : 's'}`}
    >
      ⬇ Download Selected ({selectedCount})
    </button>
  )
}
