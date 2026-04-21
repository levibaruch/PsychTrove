import { useState, useCallback } from 'react'

export function usePaperSelection() {
  const [selected, setSelected] = useState(new Set())

  const toggle = useCallback((paperId) => {
    setSelected(prev => {
      const newSet = new Set(prev)
      if (newSet.has(paperId)) {
        newSet.delete(paperId)
      } else {
        newSet.add(paperId)
      }
      return newSet
    })
  }, [])

  const selectAll = useCallback((paperIds) => {
    setSelected(new Set(paperIds))
  }, [])

  const deselectAll = useCallback(() => {
    setSelected(new Set())
  }, [])

  const isSelected = useCallback((paperId) => {
    return selected.has(paperId)
  }, [selected])

  return {
    selected,
    selectedCount: selected.size,
    toggle,
    selectAll,
    deselectAll,
    isSelected,
  }
}
