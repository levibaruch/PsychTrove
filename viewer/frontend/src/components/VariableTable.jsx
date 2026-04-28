import React, { useRef, useCallback } from 'react'
import TypeBadge from './TypeBadge'
import { formatNum } from '../utils/format'

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
}

const thStyle = {
  padding: '6px 10px',
  borderBottom: '2px solid var(--color-border)',
  textAlign: 'left',
  color: 'var(--color-text-secondary)',
  fontWeight: 600,
  fontSize: '12px',
  whiteSpace: 'nowrap',
  background: 'var(--color-surface)',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  cursor: 'default',
}

const thSortable = { ...thStyle, cursor: 'pointer', userSelect: 'none' }

const tdStyle = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'top',
}

export default function VariableTable({ variables, onRowClick, highlightTerm, sortCol, sortDir, onSort }) {
  const tbodyRef = useRef(null)

  const handleKeyDown = useCallback((e, idx) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      tbodyRef.current?.children[Math.min(idx + 1, (variables?.length ?? 1) - 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      tbodyRef.current?.children[Math.max(idx - 1, 0)]?.focus()
    } else if (e.key === 'Enter') {
      onRowClick?.(variables[idx])
    }
  }, [variables, onRowClick])

  const sortIndicator = (col) =>
    sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const highlightTokens = highlightTerm
    ? highlightTerm.split(/\s+/)
        .filter(t => !['AND', 'OR', 'NOT'].includes(t.toUpperCase()))
        .map(t => t.replace(/^"|"$/g, ''))
        .filter(Boolean)
    : []

  const highlight = (text) => {
    if (!highlightTokens.length || !text) return text
    for (const token of highlightTokens) {
      const idx = text.toLowerCase().indexOf(token.toLowerCase())
      if (idx !== -1) {
        return (
          <>
            {text.slice(0, idx)}
            <mark style={{ background: '#fef08a', borderRadius: '2px', padding: '0 1px' }}>
              {text.slice(idx, idx + token.length)}
            </mark>
            {text.slice(idx + token.length)}
          </>
        )
      }
    }
    return text
  }

  const hasPaperTitle = variables?.some(v => v.paper_title)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle} role="grid">
        <thead>
          <tr>
            <th style={thSortable} onClick={() => onSort?.('name')}>
              Name{sortIndicator('name')}
            </th>
            <th style={thSortable} onClick={() => onSort?.('description')}>
              Description{sortIndicator('description')}
            </th>
            <th style={thSortable} onClick={() => onSort?.('col_type')}>
              Type{sortIndicator('col_type')}
            </th>
            {hasPaperTitle && (
              <th style={{ ...thSortable, maxWidth: '220px' }} onClick={() => onSort?.('paper_title')}>
                Paper{sortIndicator('paper_title')}
              </th>
            )}
            <th style={thStyle} className="col-source-file">Source File</th>
            <th style={thSortable} onClick={() => onSort?.('stat_n')}>
              N{sortIndicator('stat_n')}
            </th>
            <th style={thSortable} onClick={() => onSort?.('stat_mean')}>
              Mean / Range{sortIndicator('stat_mean')}
            </th>
            <th style={thSortable} onClick={() => onSort?.('stat_sd')}>
              SD{sortIndicator('stat_sd')}
            </th>
            <th style={thStyle}>Sample Values</th>
            {variables?.[0]?.study_group !== undefined && (
              <th style={thStyle}>Study</th>
            )}
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {(variables || []).map((v, idx) => {
            const isError = v.col_type === 'llm_error'
            const stats = v.statistics || {}
            const showRange = stats.mean == null && (v.min_value != null || v.max_value != null)
            const meanOrRange = showRange
              ? `${v.min_value ?? '?'} – ${v.max_value ?? '?'}`
              : formatNum(stats.mean ?? v.stat_mean)
            return (
              <tr
                key={v.id ?? v.variable_id ?? idx}
                style={{
                  cursor: 'pointer',
                  background: isError ? '#fee2e250' : undefined,
                  opacity: !v.description ? 0.7 : 1,
                  outline: 'none',
                }}
                tabIndex={0}
                onClick={() => onRowClick?.(v)}
                onKeyDown={e => handleKeyDown(e, idx)}
              >
                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  {highlight(v.name)}
                </td>
                <td style={tdStyle}>
                  {v.description ? highlight(v.description) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                </td>
                <td style={tdStyle}>
                  <TypeBadge value={v.col_type} kind="col" />
                </td>
                {hasPaperTitle && (
                  <td style={{ ...tdStyle, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--color-text-secondary)' }}
                      title={v.paper_title}>
                    {v.paper_title || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                )}
                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: '11px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="col-source-file">
                  {v.source_file}
                </td>
                <td style={tdStyle}>{formatNum(stats.n ?? v.stat_n)}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{meanOrRange}</td>
                <td style={tdStyle}>{formatNum(stats.sd ?? v.stat_sd)}</td>
                <td style={{ ...tdStyle, maxWidth: '180px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {v.sample_values}
                  </span>
                </td>
                {v.study_group !== undefined && (
                  <td style={tdStyle}>{v.study_group}</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
