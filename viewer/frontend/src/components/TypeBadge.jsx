import React from 'react'

/*
 * Muted badge palette lifted from the DataCheck report (.b-blue/.b-green/…).
 * Desaturated paper tones rather than bright app colors. Dark variants keep
 * the same hue family at low saturation.
 */
const HUES = {
  blue:   { bg: '#e7edf3', text: '#2f4a63', darkBg: '#23303d', darkText: '#9db6cd' },
  green:  { bg: '#e9efe8', text: '#38573b', darkBg: '#27332a', darkText: '#a3bda6' },
  purple: { bg: '#ece9f1', text: '#4a3d63', darkBg: '#2e2a39', darkText: '#b6a9cd' },
  teal:   { bg: '#e4eeec', text: '#2f5650', darkBg: '#22332f', darkText: '#9bc1ba' },
  orange: { bg: '#f1ece1', text: '#7a5a2c', darkBg: '#352f23', darkText: '#c7ad84' },
  indigo: { bg: '#e9eaf1', text: '#3d3f63', darkBg: '#292b39', darkText: '#a9accd' },
  slate:  { bg: '#e9ecef', text: '#3a4452', darkBg: '#272d34', darkText: '#a6b0bc' },
  gray:   { bg: '#eeeeee', text: '#3a3a3a', darkBg: '#2c2c2c', darkText: '#b0b0b0' },
  pink:   { bg: '#f1e7ec', text: '#6b3a4d', darkBg: '#352730', darkText: '#caa3b3' },
  red:    { bg: '#f1e3e3', text: '#7a2c2c', darkBg: '#352323', darkText: '#cb9b9b' },
}

const COL_TYPE_HUE = {
  continuous: 'blue',
  continuous_comma_decimal: 'blue',
  continuous_outliers_excluded: 'orange',
  ordinal: 'indigo',
  categorical: 'green',
  binary: 'pink',
  date: 'teal',
  id: 'slate',
  text: 'gray',
  constant: 'gray',
  empty: 'gray',
  unknown: 'orange',
  llm_error: 'red',
}

const FILE_TYPE_HUE = {
  data: 'blue',
  codebook: 'purple',
  code: 'green',
  software: 'indigo',
  output: 'orange',
  supplemental: 'teal',
  readme: 'gray',
  asset: 'teal',
  other: 'gray',
  llm_error: 'red',
}

const BADGE_STYLE = {
  display: 'inline-block',
  borderRadius: 'var(--radius)',
  padding: '1px 7px',
  fontSize: '11px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  border: '1px solid rgba(0,0,0,.12)',
}

export default function TypeBadge({ value, kind = 'col' }) {
  const map = kind === 'file' ? FILE_TYPE_HUE : COL_TYPE_HUE
  const hue = HUES[map[value]] || HUES.gray
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const style = {
    ...BADGE_STYLE,
    backgroundColor: isDark ? hue.darkBg : hue.bg,
    color: isDark ? hue.darkText : hue.text,
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
