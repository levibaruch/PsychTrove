/**
 * Format a number with locale thousands separators and max 4 significant figures.
 * Returns "—" for null/undefined.
 */
export function formatNum(val, sigFigs = 4) {
  if (val === null || val === undefined) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  // Use toPrecision for significant figures, then parseFloat to remove trailing zeros
  const formatted = parseFloat(n.toPrecision(sigFigs))
  return formatted.toLocaleString('en-US')
}

/**
 * Format a stat value (skewness, kurtosis, etc.) — no "+" prefix for positive.
 */
export function formatStat(val) {
  if (val === null || val === undefined) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  return parseFloat(n.toPrecision(4)).toLocaleString('en-US')
}

/**
 * Format bytes as human-readable size (MB, GB, etc.)
 */
export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `~${parseFloat(n.toPrecision(3)).toLocaleString()} ${units[i]}`
}

/**
 * Truncate a string to maxLen characters, adding "…" if truncated.
 */
export function truncate(s, maxLen = 24) {
  if (!s || s.length <= maxLen) return s
  return s.slice(0, maxLen - 1) + '…'
}
