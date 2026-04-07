import React from 'react'

const COL_TYPE_COLORS = {
  continuous:                    { bg: '#dbeafe', text: '#1e40af', darkBg: '#1e3a5f', darkText: '#93c5fd' },
  continuous_comma_decimal:      { bg: '#dbeafe', text: '#1e40af', darkBg: '#1e3a5f', darkText: '#93c5fd' },
  continuous_outliers_excluded:  { bg: '#fef3c7', text: '#92400e', darkBg: '#3d2800', darkText: '#fcd34d' },
  ordinal:                       { bg: '#e0e7ff', text: '#3730a3', darkBg: '#1e1b4b', darkText: '#a5b4fc' },
  categorical:                   { bg: '#d1fae5', text: '#065f46', darkBg: '#052e1c', darkText: '#6ee7b7' },
  binary:                        { bg: '#fce7f3', text: '#9d174d', darkBg: '#3d0726', darkText: '#f9a8d4' },
  date:                          { bg: '#cffafe', text: '#155e75', darkBg: '#082832', darkText: '#67e8f9' },
  id:                            { bg: '#f3f4f6', text: '#374151', darkBg: '#1f2937', darkText: '#d1d5db' },
  text:                          { bg: '#f3f4f6', text: '#374151', darkBg: '#1f2937', darkText: '#d1d5db' },
  constant:                      { bg: '#f3f4f6', text: '#6b7280', darkBg: '#1f2937', darkText: '#6b7280' },
  empty:                         { bg: '#f3f4f6', text: '#9ca3af', darkBg: '#1f2937', darkText: '#4b5563' },
  unknown:                       { bg: '#fef3c7', text: '#92400e', darkBg: '#3d2800', darkText: '#fcd34d' },
  llm_error:                     { bg: '#fee2e2', text: '#991b1b', darkBg: '#3b0000', darkText: '#fca5a5' },
}

const FILE_TYPE_COLORS = {
  data:         { bg: '#dbeafe', text: '#1e40af', darkBg: '#1e3a5f', darkText: '#93c5fd' },
  codebook:     { bg: '#d1fae5', text: '#065f46', darkBg: '#052e1c', darkText: '#6ee7b7' },
  code:         { bg: '#e0e7ff', text: '#3730a3', darkBg: '#1e1b4b', darkText: '#a5b4fc' },
  software:     { bg: '#ede9fe', text: '#4c1d95', darkBg: '#1f1245', darkText: '#c4b5fd' },
  output:       { bg: '#fce7f3', text: '#9d174d', darkBg: '#3d0726', darkText: '#f9a8d4' },
  supplemental: { bg: '#f3f4f6', text: '#374151', darkBg: '#1f2937', darkText: '#d1d5db' },
  readme:       { bg: '#f3f4f6', text: '#6b7280', darkBg: '#1f2937', darkText: '#9ca3af' },
  asset:        { bg: '#cffafe', text: '#155e75', darkBg: '#082832', darkText: '#67e8f9' },
  other:        { bg: '#f3f4f6', text: '#9ca3af', darkBg: '#1f2937', darkText: '#6b7280' },
  llm_error:    { bg: '#fee2e2', text: '#991b1b', darkBg: '#3b0000', darkText: '#fca5a5' },
}

const BADGE_STYLE = {
  display: 'inline-block',
  borderRadius: '4px',
  padding: '2px 7px',
  fontSize: '11px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

export default function TypeBadge({ value, kind = 'col' }) {
  const map = kind === 'file' ? FILE_TYPE_COLORS : COL_TYPE_COLORS
  const colors = map[value] || { bg: '#f3f4f6', text: '#6b7280', darkBg: '#1f2937', darkText: '#9ca3af' }
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const style = {
    ...BADGE_STYLE,
    backgroundColor: isDark ? colors.darkBg : colors.bg,
    color: isDark ? colors.darkText : colors.text,
  }
  const label = value || 'unknown'
  const title = value === 'llm_error'
    ? 'The LLM classifier failed on all retry attempts for this item. Classification could not be determined.'
    : undefined

  return (
    <span style={style} title={title}>
      {label}
    </span>
  )
}
