export function filterVariables(variables, filterText) {
  if (!filterText) return variables

  const lowerFilter = filterText.toLowerCase()
  return variables.filter(v => {
    const name = v.name?.toLowerCase() || ''
    const desc = v.description?.toLowerCase() || ''
    return name.includes(lowerFilter) || desc.includes(lowerFilter)
  })
}
