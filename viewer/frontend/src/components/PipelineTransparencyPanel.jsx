import React, { useState, useEffect } from 'react'
import { api } from '../api/client'
import { LoadingSpinner } from './StateViews'

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 400,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
}

const panelStyle = {
  background: 'var(--color-surface)',
  width: 'min(600px, 95vw)',
  height: '100vh',
  overflowY: 'auto',
  padding: '24px',
  boxShadow: '-4px 0 20px rgba(0,0,0,0.2)',
}

const FLOW_DIAGRAM = `OSF Repository
      ↓ download
Raw Files
      ↓ unpack archives
      ↓ LLM file classification
      ↓ [optional: manual ground truth override]
      ↓ column extraction + statistics
      ↓ codebook labelling
      ↓ PsychDS conversion
PsychDS Output (what this viewer reads)`

export default function PipelineTransparencyPanel({ onClose }) {
  const [stages, setStages] = useState([])
  const [colTypes, setColTypes] = useState([])
  const [fileTypes, setFileTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState({})

  useEffect(() => {
    Promise.all([
      api.pipelineStages(),
      api.colTypes(),
      api.fileTypes(),
    ]).then(([s, ct, ft]) => {
      setStages(s.stages || [])
      setColTypes(ct.col_types || [])
      setFileTypes(ft.file_types || [])
      setLoading(false)
    })
  }, [])

  const toggle = (key) => setExpandedSections(s => ({ ...s, [key]: !s[key] }))

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>About the Pipeline</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <Section title="Data Flow">
              <pre style={{
                fontFamily: 'var(--font-mono)', fontSize: '12px',
                background: 'var(--color-surface-2)', borderRadius: 'var(--radius)',
                padding: '14px 16px', whiteSpace: 'pre', overflow: 'auto',
                color: 'var(--color-text-secondary)',
              }}>
                {FLOW_DIAGRAM}
              </pre>
            </Section>

            <Section title="Pipeline Stages">
              {stages.map(stage => (
                <div key={stage.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', marginBottom: '8px', overflow: 'hidden' }}>
                  <button
                    onClick={() => toggle(stage.id)}
                    style={{
                      width: '100%', padding: '10px 14px', textAlign: 'left',
                      background: 'var(--color-surface-2)', border: 'none', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)',
                    }}
                  >
                    {stage.name}
                    <span>{expandedSections[stage.id] ? '▲' : '▼'}</span>
                  </button>
                  {expandedSections[stage.id] && (
                    <div style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      <p style={{ marginBottom: '8px' }}>{stage.description}</p>
                      {stage.outputs?.length > 0 && (
                        <div>
                          <strong>Outputs:</strong>{' '}
                          {stage.outputs.map((o, i) => (
                            <code key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--color-surface-2)', padding: '1px 4px', borderRadius: '3px', marginRight: '4px' }}>{o}</code>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </Section>

            <Section title="Column Types">
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '11px', borderBottom: '1px solid var(--color-border)' }}>Value</th>
                    <th style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '11px', borderBottom: '1px solid var(--color-border)' }}>Assigned by</th>
                    <th style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '11px', borderBottom: '1px solid var(--color-border)' }}>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {colTypes.map(ct => (
                    <tr key={ct.value}>
                      <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--color-border)' }}>{ct.value}</td>
                      <td style={{ padding: '5px 8px', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>{ct.assigned_by}</td>
                      <td style={{ padding: '5px 8px', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>{ct.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="File Types">
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '11px', borderBottom: '1px solid var(--color-border)' }}>Value</th>
                    <th style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '11px', borderBottom: '1px solid var(--color-border)' }}>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {fileTypes.map(ft => (
                    <tr key={ft.value}>
                      <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--color-border)' }}>{ft.value}</td>
                      <td style={{ padding: '5px 8px', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>{ft.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Data Quality Indicators">
              <ul style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.8, paddingLeft: '16px' }}>
                <li><strong>[✓ Reviewed]</strong> — Ground truth validated: the file was manually reviewed by a human annotator</li>
                <li><strong>[⚠ LLM Error]</strong> — The LLM classifier failed on all retry attempts; classification could not be determined</li>
                <li><strong>[✓ Labelled]</strong> — All variables have codebook labels matched</li>
                <li><strong>[No matches]</strong> — Codebook exists but no variables matched</li>
                <li><strong>[No codebook]</strong> — No codebook file was found for this study group</li>
              </ul>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}
