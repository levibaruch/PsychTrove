import React from 'react'
import { formatNum, formatStat } from '../utils/format'

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '2px 16px',
  background: 'var(--color-surface-2)',
  borderRadius: '6px',
  padding: '10px 14px',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  fontVariantNumeric: 'tabular-nums',
}

const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '8px',
  lineHeight: '1.6',
}

const labelStyle = { color: 'var(--color-text-secondary)' }
const valueStyle = { color: 'var(--color-text-primary)', textAlign: 'right' }

function Row({ label, value }) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </div>
  )
}

export default function StatisticsGrid({ stats }) {
  if (!stats) return null
  return (
    <div style={gridStyle}>
      {/* Left column */}
      <div>
        <Row label="N (valid)" value={formatNum(stats.n, 6)} />
        <Row label="N (missing)" value={formatNum(stats.n_missing, 6)} />
        <Row label="Min" value={formatNum(stats.min_value ?? stats.minValue)} />
        <Row label="Max" value={formatNum(stats.max_value ?? stats.maxValue)} />
      </div>
      {/* Right column */}
      <div>
        <Row label="Mean" value={formatNum(stats.mean)} />
        <Row label="SD" value={formatNum(stats.sd)} />
        <Row label="SE" value={formatNum(stats.se)} />
        <Row label="Median" value={formatNum(stats.median)} />
        <Row label="IQR" value={formatNum(stats.iqr)} />
        <Row label="P25" value={formatNum(stats.p25)} />
        <Row label="P75" value={formatNum(stats.p75)} />
        <Row label="Skewness" value={formatStat(stats.skewness)} />
        <Row label="Kurtosis" value={formatStat(stats.kurtosis)} />
      </div>
    </div>
  )
}
