import React, { useState, useRef, useCallback } from 'react'
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

export default function VariableTable({ variables, onRowClick, highlightTerm }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [focusIdx, setFocusIdx] = useState(-1)
  const tbodyRef = useRef(null)

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sorted = [...(variables || [])]
  if (sortCol) {
    sorted.sort((a, b) => {
      const av = (a[sortCol] || '').toLowerCase()
      const bv = (b[sortCol] || '').toLowerCase()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }

  const highlight = (text) => {
    if (!highlightTerm || !text) return text
    const idx = text.toLowerCase().indexOf(highlightTerm.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#fef08a', borderRadius: '2px', padding: '0 1px' }}>
          {text.slice(idx, idx + highlightTerm.length)}
        </mark>
        {text.slice(idx + highlightTerm.length)}
      </>
    )
  }

  const handleKeyDown = useCallback((e, idx) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(idx + 1, sorted.length - 1)
      setFocusIdx(next)
      tbodyRef.current?.children[next]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(idx - 1, 0)
      setFocusIdx(prev)
      tbodyRef.current?.children[prev]?.focus()
    } else if (e.key === 'Enter') {
      onRowClick?.(sorted[idx])
    }
  }, [sorted, onRowClick])

  const sortIndicator = (col) =>
    sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle} role="grid">
        <thead>
          <tr>
            <th style={thSortable} onClick={() => handleSort('name')}>
              Name{sortIndicator('name')}
            </th>
            <th style={thSortable} onClick={() => handleSort('description')}>
              Description{sortIndicator('description')}
            </th>
            <th style={thStyle}>Type</th>
            <th style={thStyle} className="col-source-file">Source File</th>
            <th style={thStyle}>N</th>
            <th style={thStyle}>Mean</th>
            <th style={thStyle}>SD</th>
            <th style={thStyle}>Sample Values</th>
            {variables?.[0]?.study_group !== undefined && (
              <th style={thStyle}>Study</th>
            )}
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {sorted.map((v, idx) => {
            const isError = v.col_type === 'llm_error'
            const rowStyle = {
              cursor: 'pointer',
              background: isError ? '#fee2e250' : undefined,
              opacity: !v.description ? 0.7 : 1,
              outline: 'none',
            }
            const stats = v.statistics || {}
            return (
              <tr
                key={v.id ?? v.variable_id ?? idx}
                style={rowStyle}
                tabIndex={0}
                onClick={() => onRowClick?.(v)}
                onKeyDown={e => handleKeyDown(e, idx)}
                onFocus={() => setFocusIdx(idx)}
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
                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: '11px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="col-source-file">
                  {v.source_file}
                </td>
                <td style={tdStyle}>{formatNum(stats.n ?? v.stat_n)}</td>
                <td style={tdStyle}>{formatNum(stats.mean ?? v.stat_mean)}</td>
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
