import React, { useEffect, useRef } from 'react'

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 400,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const modalStyle = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius)',
  width: 'min(680px, 95vw)',
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
}

// Side-by-side comparison of the two search modes. Each row pairs the same
// aspect for Repository search (left) and Variable search (right).
const SEARCH_COMPARISON = [
  [
    'Finds whole studies / repositories.',
    'Finds individual measurements (columns) across every repository at once.',
  ],
  [
    'Searches the title, abstract, authors and keywords.',
    'Searches variable names, descriptions and sample values.',
  ],
  [
    'Plain text match — your query is matched as typed, no special operators.',
    'Full-text match — words match their root form (creativity also finds creative). Combine terms: space = AND, "phrase", -exclude, or.',
  ],
  [
    'Refine with Sort and Filters (participants, variables, validated, code).',
    'Refine with type, minimum N and has-description filters.',
  ],
  [
    'Use when you already know the study or topic area.',
    'Use to discover where a construct (e.g. creativity) was measured, then jump to its repository.',
  ],
]

const GLOSSARY = [
  ['Ground Truth (GT)', 'The repository was hand-checked by a person for validity. A GT tag means you do not have to re-verify the whole repository yourself — it is a trust/credibility signal.'],
  ['Labelled', 'The variable has a human-readable description/label attached. "Has description" filters to only labelled variables.'],
  ['Provenance', 'The record of where a data file came from and how DataCheck processed it: original path, original format, classification, and granularity.'],
  ['Study group', 'One experiment/dataset within a repository. A repository can contain several. A group named "shared" holds files common to all groups, not a separate experiment.'],
  ['Variable type', 'DataCheck\'s classification of a column: continuous, ordinal, binary, categorical, date, id, text, etc.'],
  ['Pipeline', 'DataCheck — the upstream tool that converts raw repositories into the standardized PsychDS form that PsychTrove indexes.'],
]

export default function HelpGlossary({ onClose, firstVisit = false }) {
  const closeRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={overlayStyle} onClick={onClose} role="dialog" aria-modal="true" aria-label="Help and glossary">
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: 600 }}>
            About PsychTrove
          </span>
          <button
            ref={closeRef}
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '0 4px' }}
            aria-label="Close"
          >✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* About */}
          <section>
            <h3 style={sectionTitle}>What it is</h3>
            <p style={paragraph}>
              PsychTrove is a searchable index of psychology and social-science data repositories.
              It lets you explore what was measured across many studies — and judge how reusable a
              dataset is — without downloading each one first.
            </p>
            <p style={paragraph}>
              It is the second half of a two-step pipeline. <strong>DataCheck</strong> takes a raw
              repository, classifies every file, extracts the columns of each dataset, infers each
              variable&rsquo;s type, matches columns to any codebook, and repackages everything into
              the standardized <strong>PsychDS</strong> format. <strong>PsychTrove</strong> then
              indexes those PsychDS outputs into a database and exposes them through this interface.
            </p>
            <p style={{ ...paragraph, marginBottom: '4px' }}>What you can do here:</p>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              <li>Search studies, or search individual variables across the whole corpus.</li>
              <li>Judge credibility at a glance — manual validation, a linked manuscript, participant N.</li>
              <li>Inspect a repository&rsquo;s files, variables and processing provenance.</li>
              <li>Jump from any variable straight to its source repository, and download archives.</li>
            </ul>
          </section>

          {/* Two searches, side by side */}
          <section>
            <h3 style={sectionTitle}>The two ways to search</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '4px', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={compareHead}>Repository search</th>
                  <th style={compareHead}>Variable search</th>
                </tr>
              </thead>
              <tbody>
                {SEARCH_COMPARISON.map(([left, right], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={compareCell}>{left}</td>
                    <td style={compareCell}>{right}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Glossary */}
          <section>
            <h3 style={sectionTitle}>Glossary</h3>
            <dl style={{ margin: 0 }}>
              {GLOSSARY.map(([term, def]) => (
                <div key={term} style={{ marginBottom: '10px' }}>
                  <dt style={{ fontWeight: 600, fontSize: '13px' }}>{term}</dt>
                  <dd style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{def}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* End marker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <span style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
            End of guide
            <span style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 'var(--radius)',
              border: '1px solid var(--color-accent)', background: 'var(--color-accent)',
              color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            }}
          >
            {firstVisit ? 'Got it — start exploring' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}

const sectionTitle = { fontSize: '14px', fontWeight: 700, margin: '0 0 6px' }
const paragraph = { fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '4px 0' }
const compareHead = {
  width: '50%', textAlign: 'left', padding: '6px 10px',
  fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)',
  borderBottom: '1.5px solid var(--color-border-strong)',
  verticalAlign: 'top',
}
const compareCell = {
  padding: '7px 10px', fontSize: '12.5px', color: 'var(--color-text-secondary)',
  lineHeight: 1.5, verticalAlign: 'top',
}
