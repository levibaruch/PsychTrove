import { useState } from 'react'

/**
 * useDownload — manages the size-fetch → confirm → stream-download flow.
 *
 * Usage:
 *   const { state, start, confirm, cancel } = useDownload()
 *
 * state: { status: 'idle'|'loading'|'ready'|'downloading', sizeInfo, error }
 */
export function useDownload() {
  const [state, setState] = useState({ status: 'idle', sizeInfo: null, error: null })
  const [pendingUrl, setPendingUrl] = useState(null)

  const start = async (sizeFn, downloadUrl) => {
    setState({ status: 'loading', sizeInfo: null, error: null })
    setPendingUrl(downloadUrl)
    try {
      const info = await sizeFn()
      setState({ status: 'ready', sizeInfo: info, error: null })
    } catch (err) {
      setState({ status: 'idle', sizeInfo: null, error: err.message })
    }
  }

  const confirm = () => {
    if (!pendingUrl) return
    setState(s => ({ ...s, status: 'downloading' }))
    // Trigger browser download
    const a = document.createElement('a')
    a.href = pendingUrl
    a.click()
    // Re-enable after a short delay
    setTimeout(() => {
      setState({ status: 'idle', sizeInfo: null, error: null })
      setPendingUrl(null)
    }, 2000)
  }

  const cancel = () => {
    setState({ status: 'idle', sizeInfo: null, error: null })
    setPendingUrl(null)
  }

  return { state, start, confirm, cancel }
}
