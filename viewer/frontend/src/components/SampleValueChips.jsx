import React from 'react'
import { truncate } from '../utils/format'

const chipStyle = {
  display: 'inline-block',
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: '2px 8px',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  marginRight: '4px',
  marginBottom: '4px',
}

export default function SampleValueChips({ value }) {
  if (!value) return null
  const chips = value.split('|').map(s => s.trim()).filter(Boolean)
  return (
    <span>
      {chips.map((chip, i) => (
        <span key={i} style={chipStyle} title={chip}>
          {truncate(chip, 24)}
        </span>
      ))}
    </span>
  )
}
