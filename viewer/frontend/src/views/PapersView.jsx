import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { api } from '../api/client'
import TypeBadge from '../components/TypeBadge'
import VariableTable from '../components/VariableTable'
import VariableFilter from '../components/VariableFilter'
import ProvenanceTable from '../components/ProvenanceTable'
import VariableDetailModal from '../components/VariableDetailModal'
import DownloadConfirmationPopover from '../components/DownloadConfirmationPopover'
import { LoadingSpinner, NoPaperSelected, ErrorBanner } from '../components/StateViews'
import { useDownload } from '../hooks/useDownload'
import { filterVariables } from '../utils/filter'
import Toast from '../components/Toast'
import '../styles/responsive.css'

const LABEL_STATUS_INFO = {
  ok: { label: '✓ Labelled', color: 'var(--color-success)' },
  no_match: { label: 'No matches', color: 'var(--color-warning)' },
  no_codebook: { label: 'No codebook', color: 'var(--color-text-muted)' },
}

// ──────────────────────────────────────────────────────────────────────────────
// Paper Card
// ──────────────────────────────────────────────────────────────────────────────

function PaperCard({ paper, selected, onSelect, onDownload }) {
  const authorText = paper.authors?.length > 0
    ? paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ` + ${paper.authors.length - 3} more` : '')
    : null

  const participantCountText = paper.max_participant_n
    ? `up to ${paper.max_participant_n.toLocaleString()} participants`
    : 'N unknown'

  return (
    <div
      onClick={() => onSelect(paper)}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(paper)}
      style={{
        padding: '12px 14px',
        cursor: 'pointer',
        borderLeft: `3px solid ${selected ? 'var(--color-accent)' : 'transparent'}`,
        background: selected ? 'var(--color-surface)' : undefined,
        borderBottom: '1px solid var(--color-border)',
        outline: 'none',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--color-surface-2)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '' }}
    >
      <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.3, marginBottom: '3px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {paper.title}
      </div>
      {authorText && (
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {authorText}
        </div>
      )}
      <div style={{ fontSize: '12px', color: 'var(--color-accent)', fontWeight: 500, marginBottom: '6px' }} title="Maximum observed sample size across variables">
        {participantCountText}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)' }}>
        <span>
          {paper.n_study_groups} {paper.n_study_groups === 1 ? 'study' : 'studies'} · {paper.n_variables?.toLocaleString()} vars · {paper.n_labelled_variables?.toLocaleString()} labelled
          {paper.has_ground_truth && (
            <span title="Ground Truth: manually validated" style={{ marginLeft: '6px', background: 'var(--color-surface-2)', color: 'var(--color-success)', border: '1px solid var(--color-border)', fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: 'var(--radius)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ✓ Validated
            </span>
          )}
          {paper.has_code && (
            <span title="Repository includes analysis code / scripts" style={{ marginLeft: '6px', background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: 'var(--radius)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Code
            </span>
          )}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onDownload(paper, e.currentTarget) }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '16px', color: 'var(--color-text-muted)',
            width: '24px', height: '24px', borderRadius: 'var(--radius)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0,
          }}
          title="Download paper"
          aria-label="Download paper"
          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          ⬇
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Study Group Row
// ──────────────────────────────────────────────────────────────────────────────

function StudyGroupRow({ paper, sg, onVarClick, onDownload }) {
  const [expanded, setExpanded] = useState(false)
  const [sgDetail, setSgDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const labelInfo = LABEL_STATUS_INFO[sg.pipeline_status?.label_status] || null

  const handleExpand = () => {
    setExpanded(e => !e)
    if (!sgDetail && !loading) {
      setLoading(true)
      api.studyGroup(paper.paper_id, sg.study_group)
        .then(d => { setSgDetail(d); setLoading(false) })
        .catch(() => setLoading(false))
    }
  }

  // Hide the study description when it merely repeats the paper-level abstract —
  // participants flagged that duplication as noise.
  const dupOfPaper = sg.description && paper.description
    && sg.description.trim() === paper.description.trim()
  const showDesc = sg.description && !dupOfPaper

  // We're already viewing the paper, so don't repeat its title on every row —
  // show only the study identifier (or "Shared files" for the shared group).
  const studyLabel = sg.study_group === 'shared'
    ? 'Shared files'
    : sg.study_group
      ? `Study ${sg.study_group}`
      : (sg.title || 'Study')

  const renderTitle = () => {
    return (
      <>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: showDesc ? '4px' : 0 }}>
          {studyLabel}
        </div>
        {showDesc && (
          <div className="study-description" title={sg.description}>
            {sg.description}
          </div>
        )}
      </>
    )
  }

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', marginBottom: '8px', overflow: 'hidden' }}>
      <div
        onClick={handleExpand}
        style={{
          padding: '10px 14px', cursor: 'pointer',
          background: 'var(--color-surface-2)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {renderTitle()}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
            {sg.n_variables?.toLocaleString()} vars · {sg.n_labelled?.toLocaleString()} labelled
          </span>
          {/* Indexing can never fail here — failed indexes are absent from the DB.
              Only the codebook stage is worth surfacing, and only when it failed. */}
          {sg.pipeline_status && !sg.pipeline_status.codebook_success && (
            <span style={{ color: 'var(--color-error)', fontSize: '12px' }}>Codebook failed ✗</span>
          )}
          {/* The "✓ Labelled" ok-state duplicates the labelled count above; show only warnings. */}
          {labelInfo && sg.pipeline_status?.label_status !== 'ok' && (
            <span style={{ fontSize: '11px', fontWeight: 500, color: labelInfo.color }}>
              {labelInfo.label}
            </span>
          )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={e => { e.stopPropagation(); onDownload(paper.paper_id, sg.study_group, e.currentTarget) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '14px' }}
            title="Download study group"
          >
            ⬇
          </button>
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '12px 14px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><LoadingSpinner /></div>
          ) : sgDetail ? (
            <>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Files</div>
              <ProvenanceTable rows={sgDetail.provenance} />
              <div style={{ fontSize: '14px', fontWeight: 600, margin: '16px 0 8px' }}>Variables</div>
              <VariableTable variables={sgDetail.variables} onRowClick={onVarClick} />
            </>
          ) : (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Failed to load study group details.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Paper Detail
// ──────────────────────────────────────────────────────────────────────────────

function PaperDetail({ paperId, onVarClick, onSgDownload, onPaperDownload, showBackButton, onBack }) {
  const [tab, setTab] = useState('overview')
  const [paper, setPaper] = useState(null)
  const [loading, setLoading] = useState(false)
  const [allVars, setAllVars] = useState(null)
  const [allFiles, setAllFiles] = useState(null)
  const [allLoading, setAllLoading] = useState(false)
  const [filterText, setFilterText] = useState('')
  const downloadRef = useRef(null)

  useEffect(() => {
    if (!paperId) return
    setLoading(true)
    setPaper(null)
    setTab('overview')
    setAllVars(null)
    setAllFiles(null)
    api.paper(paperId).then(d => { setPaper(d); setLoading(false) }).catch(() => setLoading(false))
  }, [paperId])

  // All Files and All Variables both come from the per-study-group endpoint;
  // fetch every group once and split the results.
  const ensureAllGroups = () => {
    if (allVars || allLoading) return
    setAllLoading(true)
    Promise.all(
      (paper?.study_groups || []).map(sg => api.studyGroup(paperId, sg.study_group))
    ).then(results => {
      setAllVars(results.flatMap(r => (r.variables || []).map(v => ({ ...v, study_group: r.study_group }))))
      setAllFiles(results.flatMap(r => (r.provenance || []).map(p => ({ ...p, study_group: r.study_group }))))
      setAllLoading(false)
    }).catch(() => setAllLoading(false))
  }

  const openAggregateTab = (key) => {
    setTab(key)
    ensureAllGroups()
  }

  if (!paperId) return <NoPaperSelected />
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><LoadingSpinner /></div>
  if (!paper) return <ErrorBanner message="Failed to load paper" />

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {showBackButton && (
        <button onClick={onBack} className="back-to-list-btn" style={{ margin: '12px 16px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontSize: '13px', textAlign: 'left' }}>
          ← Back to list
        </button>
      )}
      <div style={{ padding: '16px 20px 0', borderBottom: '1px solid var(--color-border)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{paper.title}</h2>
        {paper.authors?.length > 0 && (
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            {paper.authors.join(', ')}
          </p>
        )}
        <CredibilityStrip paper={paper} />
        <div style={{ display: 'flex', gap: '0' }}>
          {['Overview', 'Studies', 'All Files', 'All Variables'].map((t, i) => {
            const key = ['overview', 'studies', 'allfiles', 'allvars'][i]
            const isAggregate = key === 'allfiles' || key === 'allvars'
            return (
              <button
                key={key}
                onClick={() => isAggregate ? openAggregateTab(key) : setTab(key)}
                style={{
                  padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: tab === key ? 600 : 400,
                  color: tab === key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  borderBottom: tab === key ? '2px solid var(--color-accent)' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {paper.description && (
              <ExpandableText text={paper.description} maxLines={4} />
            )}
            {paper.doi && (
              <p style={{ fontSize: '13px' }}>
                <strong>DOI:</strong>{' '}
                <a href={paper.doi} target="_blank" rel="noopener noreferrer">{paper.doi} ↗</a>
              </p>
            )}
            {paper.keywords?.length > 0 && (
              <div>
                <strong style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Keywords</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                  {paper.keywords.map((k, i) => (
                    <span key={i} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '2px 8px', fontSize: '12px' }}>
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Pipeline v{paper.pipeline_version} · Converted {paper.conversion_date} · Source: OSF
            </p>
            <button
              ref={downloadRef}
              onClick={() => onPaperDownload(paper.paper_id, downloadRef.current)}
              style={{
                alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 'var(--radius)',
                border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                cursor: 'pointer', fontSize: '13px',
              }}
            >
              ⬇ Download full repository
            </button>
          </div>
        )}
        {tab === 'studies' && (
          <div>
            {paper.study_groups?.map(sg => (
              <StudyGroupRow
                key={sg.study_group}
                paper={paper}
                sg={sg}
                onVarClick={onVarClick}
                onDownload={onSgDownload}
              />
            ))}
          </div>
        )}
        {tab === 'allfiles' && (
          <div>
            {allLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}><LoadingSpinner /></div>
            ) : allFiles ? (
              <ProvenanceTable rows={allFiles} />
            ) : null}
          </div>
        )}
        {tab === 'allvars' && (
          <div>
            {allVars && <VariableFilter value={filterText} onChange={setFilterText} />}
            {allLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}><LoadingSpinner /></div>
            ) : allVars ? (
              <FilteredVariables variables={allVars} filterText={filterText} onRowClick={onVarClick} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

function FilteredVariables({ variables, filterText, onRowClick }) {
  const filtered = useMemo(() => filterVariables(variables, filterText), [variables, filterText])

  if (filtered.length === 0 && filterText) {
    return <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '16px 0' }}>No variables match your filter.</p>
  }

  return <VariableTable variables={filtered} onRowClick={onRowClick} stickyHeader />
}

// Quality / context cues a researcher uses to judge a repository's credibility.
function CredibilityStrip({ paper }) {
  const gt = paper.has_ground_truth
  const manuscript = paper.doi
  const n = paper.max_participant_n

  const chip = (color, content, title) => (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: 'var(--color-surface-2)', color,
      border: '1px solid var(--color-border)', borderLeft: `3px solid ${color}`,
      borderRadius: 'var(--radius)', padding: '2px 9px', fontSize: '12px', fontWeight: 700,
    }}>{content}</span>
  )

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', margin: '0 0 12px' }}>
      {gt
        ? chip('var(--color-success)', '✓ Manually validated', 'Ground Truth: a person hand-checked this repository for validity, so you do not have to re-verify it yourself.')
        : chip('var(--color-text-muted)', 'Not hand-validated', 'No Ground Truth tag: this repository has not been manually checked for validity.')}
      {manuscript
        ? <a href={manuscript} target="_blank" rel="noopener noreferrer"
             title="Open the connected manuscript to assess the methodology behind this data"
             style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--color-accent)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderLeft: '3px solid var(--color-accent)', borderRadius: 'var(--radius)', padding: '2px 9px', textDecoration: 'none' }}>
            Linked manuscript &rarr;
          </a>
        : chip('var(--color-text-muted)', 'No linked manuscript', 'No DOI/manuscript recorded for this repository.')}
      {n != null && chip('var(--color-text-secondary)', `N up to ${n.toLocaleString()}`, 'Maximum observed sample size across this repository’s variables')}
    </div>
  )
}

function ExpandableText({ text, maxLines }) {
  const [expanded, setExpanded] = useState(false)
  const style = expanded ? {} : {
    display: '-webkit-box',
    WebkitLineClamp: maxLines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  }
  return (
    <div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6, ...style }}>{text}</p>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontSize: '12px', marginTop: '4px', padding: 0 }}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// PapersView (main)
// ──────────────────────────────────────────────────────────────────────────────

export default function PapersView({ openPaperReq }) {
  const [papers, setPapers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [hasLabels, setHasLabels] = useState(false)
  const [hasGT, setHasGT] = useState(false)
  const [hasCode, setHasCode] = useState(false)
  const [minN, setMinN] = useState(null)
  const [minVars, setMinVars] = useState(null)
  const [sortBy, setSortBy] = useState('title')
  const [sortDir, setSortDir] = useState('asc')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedPaper, setSelectedPaper] = useState(null)
  const [selectedPaperId, setSelectedPaperId] = useState(null)
  const [showDetail, setShowDetail] = useState(false)

  // Variable modal
  const [modalVarId, setModalVarId] = useState(null)

  // Download states
  const paperDownload = useDownload()
  const sgDownload = useDownload()
  const [downloadAnchor, setDownloadAnchor] = useState(null)
  const [downloadContext, setDownloadContext] = useState(null)
  const [toast, setToast] = useState(null)

  // Fetch papers
  useEffect(() => {
    setLoading(true)
    const params = {}
    if (query) params.q = query
    if (hasLabels) params.has_labels = true
    if (hasGT) params.has_ground_truth = true
    if (hasCode) params.has_code = true
    if (minN != null) params.min_n = minN
    if (minVars != null) params.min_vars = minVars
    if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
    api.papers(params).then(d => {
      setPapers(d.papers || [])
      setTotal(d.total || 0)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [query, hasLabels, hasGT, hasCode, minN, minVars, sortBy, sortDir])

  const activeFilterCount =
    (hasLabels ? 1 : 0) + (hasGT ? 1 : 0) + (hasCode ? 1 : 0) +
    (minN != null ? 1 : 0) + (minVars != null ? 1 : 0)

  const clearFilters = () => {
    setHasLabels(false)
    setHasGT(false)
    setHasCode(false)
    setMinN(null)
    setMinVars(null)
  }

  const handleSelectPaper = (paper) => {
    setSelectedPaper(paper)
    setSelectedPaperId(paper.paper_id)
    setShowDetail(true)
  }

  // Open a paper requested from another view (e.g. a variable result).
  useEffect(() => {
    if (!openPaperReq?.paperId) return
    setSelectedPaper(null)
    setSelectedPaperId(openPaperReq.paperId)
    setShowDetail(true)
  }, [openPaperReq])

  const handlePaperDownload = async (paperId, anchor) => {
    setDownloadAnchor(anchor)
    setDownloadContext({ type: 'paper', paperId })
    await paperDownload.start(
      () => api.paperDownloadSize(paperId),
      api.paperDownloadUrl(paperId)
    )
  }

  const handleSgDownload = async (paperId, studyGroup, anchor) => {
    setDownloadAnchor(anchor)
    setDownloadContext({ type: 'sg', paperId, studyGroup })
    await sgDownload.start(
      () => api.studyGroupDownloadSize(paperId, studyGroup),
      api.studyGroupDownloadUrl(paperId, studyGroup)
    )
  }

  const activeDownload = paperDownload.state.status !== 'idle' ? paperDownload
                         : sgDownload.state.status !== 'idle' ? sgDownload : null

  const handleDownloadConfirm = () => {
    activeDownload?.confirm()
    setToast('Preparing download… this may take a moment for large packages.')
  }

  const handleDownloadCancel = () => {
    paperDownload.cancel()
    sgDownload.cancel()
  }

  return (
    <div className="papers-split" style={{ display: 'flex', flex: 1, minHeight: 0, height: '100%' }}>
      {/* Left panel */}
      <div
        className={`papers-list-panel ${showDetail ? 'hidden-mobile' : ''}`}
        style={{
          width: '30%', minWidth: '280px', maxWidth: '360px',
          borderRight: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--color-surface)',
        }}
      >
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <input
            type="search"
            placeholder="Search papers…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%', height: '40px', padding: '0 12px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)', fontSize: '15px',
              background: 'var(--color-bg)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-focus)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
          />
          {/* Sort + Filters trigger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px' }}>
            <select
              id="paper-sort"
              aria-label="Sort papers"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: 'var(--radius)', fontSize: '12px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
            >
              <option value="title">Sort: Title</option>
              <option value="n_participants">Sort: Participants (N)</option>
              <option value="n_variables">Sort: Variables</option>
              <option value="n_labelled">Sort: Labelled variables</option>
            </select>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              style={{ padding: '5px 9px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', fontSize: '12px' }}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowFilters(s => !s)}
                title="Filter papers"
                style={{
                  padding: '5px 10px', borderRadius: 'var(--radius)',
                  border: `1px solid ${activeFilterCount ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: showFilters ? 'var(--color-surface-2)' : 'var(--color-surface)',
                  color: activeFilterCount ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontSize: '12px', fontWeight: activeFilterCount ? 700 : 400, whiteSpace: 'nowrap',
                }}
              >
                Filters{activeFilterCount ? ` (${activeFilterCount})` : ''} ▾
              </button>
              {showFilters && (
                <>
                  {/* click-away */}
                  <div onClick={() => setShowFilters(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 41,
                    width: '260px', background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.18)', padding: '12px 14px',
                    display: 'flex', flexDirection: 'column', gap: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="eyebrow">Filter</span>
                      {activeFilterCount > 0 && (
                        <button onClick={clearFilters} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontSize: '12px', padding: 0 }}>
                          Clear all
                        </button>
                      )}
                    </div>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      Minimum participants (N)
                      <input
                        type="number" min="0" placeholder="any"
                        value={minN ?? ''}
                        onChange={e => setMinN(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                        style={{ padding: '6px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: '13px' }}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      Minimum variables
                      <input
                        type="number" min="0" placeholder="any"
                        value={minVars ?? ''}
                        onChange={e => setMinVars(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                        style={{ padding: '6px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: '13px' }}
                      />
                    </label>
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px' }} title="Has at least one labelled variable">
                        <input type="checkbox" checked={hasLabels} onChange={e => setHasLabels(e.target.checked)} />
                        Has labelled variables
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px' }} title="Ground Truth: manually validated">
                        <input type="checkbox" checked={hasGT} onChange={e => setHasGT(e.target.checked)} />
                        Manually validated (GT)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px' }} title="Repository includes analysis code / scripts">
                        <input type="checkbox" checked={hasCode} onChange={e => setHasCode(e.target.checked)} />
                        Includes analysis code
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}><LoadingSpinner /></div>
          ) : (
            <>
              <div style={{ padding: '6px 14px', fontSize: '11px', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                {total.toLocaleString()} papers
              </div>
              {papers.map(p => (
                <PaperCard
                  key={p.paper_id}
                  paper={p}
                  selected={selectedPaperId === p.paper_id}
                  onSelect={handleSelectPaper}
                  onDownload={handlePaperDownload}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div
        className={`papers-detail-panel ${showDetail ? 'visible' : ''}`}
        style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <PaperDetail
          paperId={selectedPaperId}
          onVarClick={(v) => setModalVarId(v.id ?? v.variable_id)}
          onSgDownload={handleSgDownload}
          onPaperDownload={handlePaperDownload}
          showBackButton={showDetail}
          onBack={() => setShowDetail(false)}
        />
      </div>

      {/* Download confirmation popover */}
      {activeDownload && activeDownload.state.status !== 'idle' && (
        <DownloadConfirmationPopover
          anchorEl={downloadAnchor}
          status={activeDownload.state.status}
          sizeInfo={activeDownload.state.sizeInfo}
          onConfirm={handleDownloadConfirm}
          onCancel={handleDownloadCancel}
        />
      )}

      {/* Variable detail modal */}
      {modalVarId != null && (
        <VariableDetailModal
          variableId={modalVarId}
          onClose={() => setModalVarId(null)}
          onOpenPaper={(paperId) => {
            setModalVarId(null)
            setSelectedPaper(null)
            setSelectedPaperId(paperId)
            setShowDetail(true)
          }}
          onDownload={(type, idOrName) => {
            if (type === 'variable') {
              window.open(api.variableDownloadUrl(idOrName))
            } else {
              window.open(api.variableSearchDownloadUrl({ q: idOrName }))
            }
          }}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
