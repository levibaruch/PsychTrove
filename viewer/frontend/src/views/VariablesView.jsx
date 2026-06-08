import React, { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api/client'
import TypeBadge from '../components/TypeBadge'
import VariableTable from '../components/VariableTable'
import MinNFilter from '../components/MinNFilter'
import VariableDetailModal from '../components/VariableDetailModal'
import DownloadConfirmationPopover from '../components/DownloadConfirmationPopover'
import { EmptySearch, NoResults, LoadingSpinner } from '../components/StateViews'
import { useDownload } from '../hooks/useDownload'
import Toast from '../components/Toast'
import '../styles/responsive.css'

const COL_TYPES = [
  'continuous', 'ordinal', 'binary', 'constant', 'categorical',
  'date', 'id', 'text', 'continuous_comma_decimal',
  'continuous_outliers_excluded', 'empty', 'unknown', 'llm_error',
]

const PAGE_SIZES = [25, 50, 100]

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function VariablesView({ onOpenPaper, onShowHelp }) {
  const [query, setQuery] = useState('')
  const [paperQuery, setPaperQuery] = useState('')
  const [colType, setColType] = useState('')
  const [hasDescription, setHasDescription] = useState(false)
  const [minN, setMinN] = useState(null)

  const [results, setResults] = useState(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortBy, setSortBy] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const [modalVarId, setModalVarId] = useState(null)
  const [deduplicate, setDeduplicate] = useState(true)
  const download = useDownload()
  const [dlAnchor, setDlAnchor] = useState(null)
  const dlBtnRef = useRef(null)
  const [toast, setToast] = useState(null)

  const debouncedQuery = useDebounce(query, 300)
  const debouncedPaperQuery = useDebounce(paperQuery, 300)

  // Reset to page 1 when filters/query/sort change
  useEffect(() => { setPage(1) }, [debouncedQuery, debouncedPaperQuery, colType, hasDescription, minN, sortBy, sortDir, pageSize])

  useEffect(() => {
    if (!debouncedQuery) {
      setResults(null)
      setTotal(0)
      return
    }
    setLoading(true)
    setError(null)
    const params = {
      q: debouncedQuery,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }
    if (colType) params.col_type = colType
    if (hasDescription) params.has_description = true
    if (debouncedPaperQuery) params.paper_q = debouncedPaperQuery
    if (minN != null) params.min_n = minN
    if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
    api.searchVariables(params).then(d => {
      setResults(d.results || [])
      setTotal(d.total || 0)
      setLoading(false)
    }).catch(err => {
      setError(err.message)
      setLoading(false)
    })
  }, [debouncedQuery, debouncedPaperQuery, colType, hasDescription, minN, page, pageSize, sortBy, sortDir])

  const handleSort = useCallback((col) => {
    setSortBy(prev => {
      if (prev === col) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        return col
      }
      setSortDir('asc')
      return col
    })
  }, [])

  const handleDownload = async (anchor) => {
    setDlAnchor(anchor)
    await download.start(
      () => api.variableSearchDownloadSize({ q: debouncedQuery, col_type: colType || undefined, has_description: hasDescription || undefined, deduplicate_files: deduplicate }),
      api.variableSearchDownloadUrl({ q: debouncedQuery, col_type: colType || undefined, has_description: hasDescription || undefined, deduplicate_files: deduplicate })
    )
  }

  const handleConfirm = () => {
    download.confirm()
    setToast('Preparing download… this may take a moment for large packages.')
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
      {/* Search bar */}
      <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <input
          type="search"
          placeholder='Search variables… (space = AND, "phrase", -exclude, or)'
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%', height: '44px', fontSize: '15px',
            padding: '0 14px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-focus)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
        />
        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          Searches variable names, descriptions and sample values across every repository.{' '}
          <button
            onClick={onShowHelp}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-accent)', fontSize: '12px' }}
          >
            How search works ↗
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
          <input
            type="search"
            placeholder="Filter by paper title…"
            value={paperQuery}
            onChange={e => setPaperQuery(e.target.value)}
            style={{
              flex: '1 1 200px', height: '34px', fontSize: '13px',
              padding: '0 10px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              background: 'var(--color-bg)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-focus)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <label htmlFor="col-type-filter" style={{ color: 'var(--color-text-secondary)' }}>Type:</label>
            <select
              id="col-type-filter"
              value={colType}
              onChange={e => setColType(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 'var(--radius)', fontSize: '12px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
            >
              <option value="">All types</option>
              {COL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <MinNFilter value={minN} onChange={setMinN} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={hasDescription} onChange={e => setHasDescription(e.target.checked)} />
            <span style={{ color: 'var(--color-text-secondary)' }}>Has description</span>
          </label>
        </div>
      </div>

      {/* Results toolbar */}
      {results !== null && debouncedQuery && (
        <div style={{
          padding: '8px 24px', background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {total === 0 ? 'No results' : `${rangeStart}–${rangeEnd} of ${total.toLocaleString()}`}
            {debouncedPaperQuery && <> in papers matching <em>'{debouncedPaperQuery}'</em></>}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Page size */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <span>Show</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                style={{ padding: '2px 6px', borderRadius: 'var(--radius)', fontSize: '12px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
              >
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={paginationBtnStyle(page <= 1)}
              >←</button>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', minWidth: '70px', textAlign: 'center' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={paginationBtnStyle(page >= totalPages)}
              >→</button>
            </div>
            <button
              ref={dlBtnRef}
              disabled={total === 0}
              onClick={() => handleDownload(dlBtnRef.current)}
              style={{
                padding: '4px 12px', borderRadius: 'var(--radius)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', cursor: total === 0 ? 'not-allowed' : 'pointer',
                fontSize: '12px', opacity: total === 0 ? 0.5 : 1,
              }}
            >⬇ Download all</button>
          </div>
        </div>
      )}

      {/* Results area — owns scrolling so the table header can stay sticky.
          minHeight:0 defeats the flex default (min-height:auto) that would otherwise
          let this grow to its content and push scrolling up to the outer container. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px' }}>
        {!debouncedQuery ? (
          <EmptySearch />
        ) : loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><LoadingSpinner /></div>
        ) : error ? (
          <div style={{ padding: '16px 0' }}>
            <span style={{ color: 'var(--color-error)', fontSize: '13px' }}>Error: {error}</span>
          </div>
        ) : results?.length === 0 ? (
          <NoResults query={debouncedQuery} />
        ) : (
          <div style={{ marginTop: '16px' }}>
            <VariableTable
              variables={results}
              onRowClick={v => setModalVarId(v.variable_id)}
              highlightTerm={debouncedQuery}
              sortCol={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              stickyHeader
              hideSourceFile
            />
          </div>
        )}
      </div>

      {/* Download confirmation */}
      {download.state.status !== 'idle' && (
        <DownloadConfirmationPopover
          anchorEl={dlAnchor}
          status={download.state.status}
          sizeInfo={download.state.sizeInfo}
          onConfirm={handleConfirm}
          onCancel={download.cancel}
          showDeduplicate
          deduplicate={deduplicate}
          onDeduplicateChange={setDeduplicate}
          extraInfo="Includes normalized CSVs + MANIFEST.csv describing provenance for every file"
        />
      )}

      {/* Variable detail modal */}
      {modalVarId != null && (
        <VariableDetailModal
          variableId={modalVarId}
          onClose={() => setModalVarId(null)}
          onOpenPaper={onOpenPaper ? (paperId) => { setModalVarId(null); onOpenPaper(paperId) } : undefined}
          onDownload={(type, idOrName) => {
            if (type === 'variable') {
              window.open(api.variableDownloadUrl(idOrName))
            } else {
              window.open(api.variableSearchDownloadUrl({ q: idOrName }))
            }
          }}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}

function paginationBtnStyle(disabled) {
  return {
    padding: '3px 10px', borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '13px',
    opacity: disabled ? 0.4 : 1,
    color: 'var(--color-text-primary)',
  }
}
