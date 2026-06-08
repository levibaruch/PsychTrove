import React, { useState } from 'react'
import { formatBytes } from '../utils/format'
import { LoadingSpinner } from './StateViews'

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
}

const popoverStyle = {
  position: 'absolute',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: '16px',
  width: 'min(340px, 90vw)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
  zIndex: 201,
}

export default function DownloadConfirmationPopover({
  anchorEl,
  status,         // 'loading' | 'ready' | 'downloading'
  sizeInfo,       // API response from /download/size
  onConfirm,
  onCancel,
  showDeduplicate = false,
  onDeduplicateChange,
  deduplicate = true,
  filename,
  extraInfo,
}) {
  // Position near anchor
  let popStyle = { ...popoverStyle }
  if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect()
    popStyle.top = rect.bottom + window.scrollY + 8
    popStyle.left = Math.max(8, rect.left + window.scrollX - 160 + rect.width / 2)
  } else {
    popStyle.top = '50%'
    popStyle.left = '50%'
    popStyle.transform = 'translate(-50%, -50%)'
  }

  return (
    <>
      <div style={overlayStyle} onClick={onCancel} />
      <div style={popStyle} onClick={e => e.stopPropagation()}>
        {status === 'loading' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
            <LoadingSpinner size={20} />
            <span style={{ color: 'var(--color-text-secondary)' }}>Calculating size…</span>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '12px' }}>
              {filename && (
                <div style={{ fontWeight: 600, marginBottom: '6px', wordBreak: 'break-all', fontSize: '13px' }}>
                  {filename}
                </div>
              )}
              {sizeInfo && (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', lineHeight: 1.6 }}>
                  {sizeInfo.n_files != null && (
                    <div>{sizeInfo.n_files.toLocaleString()} files · {formatBytes(sizeInfo.total_bytes_uncompressed)} (uncompressed)</div>
                  )}
                  {sizeInfo.n_source_files != null && (
                    <div>
                      {sizeInfo.n_matching_variables?.toLocaleString()} variables · {sizeInfo.n_source_files?.toLocaleString()} files · {sizeInfo.n_papers?.toLocaleString()} papers
                    </div>
                  )}
                  {sizeInfo.total_bytes_uncompressed != null && sizeInfo.n_files == null && (
                    <div>{formatBytes(sizeInfo.total_bytes_uncompressed)} (uncompressed)</div>
                  )}
                  {extraInfo && <div style={{ marginTop: '4px' }}>{extraInfo}</div>}
                </div>
              )}
            </div>

            {showDeduplicate && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deduplicate}
                  onChange={e => onDeduplicateChange?.(e.target.checked)}
                />
                Deduplicate files
              </label>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={onCancel}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={status === 'downloading'}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  cursor: status === 'downloading' ? 'default' : 'pointer',
                  opacity: status === 'downloading' ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {status === 'downloading' ? <LoadingSpinner size={14} /> : null}
                ⬇ Download
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
