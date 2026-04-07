import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import TypeBadge from './TypeBadge'
import StatisticsGrid from './StatisticsGrid'
import SampleValueChips from './SampleValueChips'
import { LoadingSpinner } from './StateViews'
import { formatBytes } from '../utils/format'

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 300,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const modalStyle = {
  background: 'var(--color-surface)',
  borderRadius: '10px',
  width: 'min(720px, 95vw)',
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
}

const headerStyle = {
  padding: '16px 20px 0',
  borderBottom: '1px solid var(--color-border)',
}

const tabBarStyle = {
  display: 'flex',
  gap: '0',
  marginTop: '12px',
}

const bodyStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px 20px',
}

const footerStyle = {
  position: 'sticky',
  bottom: 0,
  background: 'var(--color-surface)',
  borderTop: '1px solid var(--color-border)',
  padding: '12px 20px',
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
        marginBottom: '-1px',
      }}
    >
      {label}
    </button>
  )
}

function DownloadButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: '6px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-text-primary)',
        cursor: 'pointer',
        fontSize: '13px',
      }}
    >
      ⬇ {label}
    </button>
  )
}

export default function VariableDetailModal({ variableId, onClose, onDownload }) {
  const [tab, setTab] = useState('variable')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stages, setStages] = useState([])
  const [expandedStages, setExpandedStages] = useState({})
  const modalRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    Promise.all([
      api.variable(variableId),
      api.pipelineStages(),
    ]).then(([vData, stagesData]) => {
      setData(vData)
      setStages(stagesData.stages || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [variableId])

  // Focus trap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const ctx = data?.source_file_context

  return (
    <div style={overlayStyle} onClick={onClose} role="dialog" aria-modal="true">
      <div style={modalStyle} ref={modalRef} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 600, marginRight: '10px' }}>
                {data?.name || '…'}
              </span>
              {data?.col_type && <TypeBadge value={data.col_type} kind="col" />}
              {data?.description && (
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  "{data.description}"
                </div>
              )}
            </div>
            <button
              ref={closeRef}
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '0 4px' }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div style={tabBarStyle}>
            <Tab label="Variable" active={tab === 'variable'} onClick={() => setTab('variable')} />
            <Tab label="Provenance" active={tab === 'provenance'} onClick={() => setTab('provenance')} />
          </div>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
              <LoadingSpinner />
            </div>
          ) : !data ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>Failed to load variable data.</p>
          ) : tab === 'variable' ? (
            <VariableTab data={data} />
          ) : (
            <ProvenanceTab data={data} ctx={ctx} stages={stages} expanded={expandedStages} onToggleStage={(id) => setExpandedStages(s => ({ ...s, [id]: !s[id] }))} />
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <DownloadButton
            label="Download this data file"
            onClick={() => onDownload?.('variable', data?.variable_id)}
          />
          <DownloadButton
            label={`Download all "${data?.name}" files`}
            onClick={() => onDownload?.('search', data?.name)}
          />
        </div>
      </div>
    </div>
  )
}

function VariableTab({ data }) {
  const stats = data.statistics
  const ctx = data.source_file_context

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Row label="Source file">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{data.source_file}</span>
      </Row>
      <Row label="Sample values">
        <SampleValueChips value={data.sample_values} />
      </Row>
      {data.col_type === 'binary' && data.value_pattern && (
        <Row label="Values">
          <SampleValueChips value={data.value_pattern} />
        </Row>
      )}
      {stats && (
        <StatisticsGrid stats={{ ...stats, min_value: data.min_value, max_value: data.max_value }} />
      )}
    </div>
  )
}

function ProvenanceTab({ data, ctx, stages, expanded, onToggleStage }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {ctx ? (
        <>
          <Section title="Source File Context">
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <tbody>
                <CtxRow label="Original path" value={ctx.original_file?.rel_path} mono />
                <CtxRow label="Format" value={ctx.original_file?.format} />
                <CtxRow label="File size" value={ctx.original_file?.size_bytes != null ? formatBytes(ctx.original_file.size_bytes) : '—'} />
                <CtxRow label="Data granularity" value={ctx.original_file?.data_granularity || '—'} />
                <CtxRow label="Read function" value={ctx.conversion?.method || '—'} mono />
                <CtxRow label="Encoding normalized" value={ctx.conversion?.encoding_normalized ? 'Yes' : 'No'} />
                <CtxRow label="Haven labels extracted" value={ctx.conversion?.haven_labels_extracted ? 'Yes' : 'No'} />
                <CtxRow label="Rows written" value={ctx.conversion?.rows_written?.toLocaleString()} />
                <CtxRow label="Columns written" value={ctx.conversion?.columns_written?.toLocaleString()} />
              </tbody>
            </table>
          </Section>

          {ctx.sibling_variables?.length > 0 && (
            <Section title="Sibling Variables">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ctx.sibling_variables.map((sv, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px', padding: '2px 8px',
                    fontFamily: 'var(--font-mono)', fontSize: '11px',
                  }} title={sv.description || ''}>
                    {sv.name}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </>
      ) : (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
          Source file context not available.
        </p>
      )}

      {stages.length > 0 && (
        <Section title="How was this produced?">
          {stages.map(stage => (
            <div key={stage.id} style={{
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              marginBottom: '6px',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => onToggleStage(stage.id)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: 'var(--color-surface-2)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                }}
              >
                {stage.name}
                <span>{expanded[stage.id] ? '▲' : '▼'}</span>
              </button>
              {expanded[stage.id] && (
                <div style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {stage.description}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: 'var(--color-text-primary)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <div>{children}</div>
    </div>
  )
}

function CtxRow({ label, value, mono }) {
  return (
    <tr>
      <td style={{ padding: '3px 0', color: 'var(--color-text-secondary)', width: '160px', verticalAlign: 'top' }}>{label}</td>
      <td style={{ padding: '3px 0 3px 12px', fontFamily: mono ? 'var(--font-mono)' : undefined }}>{value ?? '—'}</td>
    </tr>
  )
}
