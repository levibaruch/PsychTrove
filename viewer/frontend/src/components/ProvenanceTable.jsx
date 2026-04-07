import React from 'react'
import TypeBadge from './TypeBadge'

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '12px' }
const thStyle = {
  padding: '6px 10px',
  borderBottom: '2px solid var(--color-border)',
  textAlign: 'left',
  color: 'var(--color-text-secondary)',
  fontWeight: 600,
  fontSize: '11px',
  background: 'var(--color-surface)',
  position: 'sticky',
  top: 0,
}
const tdStyle = {
  padding: '5px 10px',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'top',
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
}

export default function ProvenanceTable({ rows }) {
  if (!rows || rows.length === 0) return (
    <p style={{ color: 'var(--color-text-muted)', padding: '12px', fontSize: '12px' }}>
      No provenance data available.
    </p>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>PsychDS Path</th>
            <th style={thStyle}>Original Path</th>
            <th style={thStyle}>Format</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Group</th>
            <th style={thStyle}>Granularity</th>
            <th style={thStyle}>GT Validated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isError = r.pipeline_type === 'llm_error'
            return (
              <tr key={r.id ?? i} style={{ background: isError ? '#fee2e230' : undefined }}>
                <td style={tdStyle}>{r.psychds_path}</td>
                <td style={{ ...tdStyle, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.original_rel_path || '—'}
                </td>
                <td style={tdStyle}>{r.original_format || '—'}</td>
                <td style={{ ...tdStyle, fontFamily: 'inherit' }}>
                  <TypeBadge value={r.pipeline_type} kind="file" />
                </td>
                <td style={tdStyle}>{r.pipeline_group || '—'}</td>
                <td style={tdStyle}>{r.pipeline_data_granularity || '—'}</td>
                <td style={{ ...tdStyle, fontFamily: 'inherit', textAlign: 'center' }}>
                  {r.ground_truth_validated
                    ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓</span>
                    : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
