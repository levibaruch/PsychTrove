const BASE = import.meta.env.VITE_API_BASE || ''

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || res.statusText)
  }
  return res.json()
}

export const api = {
  health: () => request('/health'),

  corpusStats: () => request('/api/corpus/stats'),

  papers: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.has_labels != null) qs.set('has_labels', params.has_labels)
    if (params.has_ground_truth != null) qs.set('has_ground_truth', params.has_ground_truth)
    if (params.limit) qs.set('limit', params.limit)
    if (params.offset) qs.set('offset', params.offset)
    return request(`/api/papers?${qs}`)
  },

  paper: (paperId) => request(`/api/papers/${encodeURIComponent(paperId)}`),

  studyGroup: (paperId, studyGroup) =>
    request(`/api/papers/${encodeURIComponent(paperId)}/groups/${encodeURIComponent(studyGroup)}`),

  searchVariables: (params = {}) => {
    const qs = new URLSearchParams({ q: params.q || '' })
    if (params.col_type) qs.set('col_type', params.col_type)
    if (params.has_description != null) qs.set('has_description', params.has_description)
    if (params.paper_id) qs.set('paper_id', params.paper_id)
    if (params.limit) qs.set('limit', params.limit)
    if (params.offset) qs.set('offset', params.offset)
    return request(`/api/variables/search?${qs}`)
  },

  variable: (variableId) => request(`/api/variables/${variableId}`),

  pipelineStages: () => request('/api/pipeline/stages'),
  colTypes: () => request('/api/pipeline/col_types'),
  fileTypes: () => request('/api/pipeline/file_types'),

  paperDownloadSize: (paperId) =>
    request(`/api/papers/${encodeURIComponent(paperId)}/download/size`),

  studyGroupDownloadSize: (paperId, studyGroup) =>
    request(`/api/papers/${encodeURIComponent(paperId)}/groups/${encodeURIComponent(studyGroup)}/download/size`),

  variableSearchDownloadSize: (params = {}) => {
    const qs = new URLSearchParams({ q: params.q || '' })
    if (params.col_type) qs.set('col_type', params.col_type)
    if (params.has_description != null) qs.set('has_description', params.has_description)
    if (params.deduplicate_files != null) qs.set('deduplicate_files', params.deduplicate_files)
    return request(`/api/variables/search/download/size?${qs}`)
  },

  paperDownloadUrl: (paperId) =>
    `${BASE}/api/papers/${encodeURIComponent(paperId)}/download`,

  studyGroupDownloadUrl: (paperId, studyGroup) =>
    `${BASE}/api/papers/${encodeURIComponent(paperId)}/groups/${encodeURIComponent(studyGroup)}/download`,

  variableSearchDownloadUrl: (params = {}) => {
    const qs = new URLSearchParams({ q: params.q || '' })
    if (params.col_type) qs.set('col_type', params.col_type)
    if (params.has_description != null) qs.set('has_description', params.has_description)
    if (params.deduplicate_files != null) qs.set('deduplicate_files', params.deduplicate_files)
    return `${BASE}/api/variables/search/download?${qs}`
  },

  variableDownloadUrl: (variableId) =>
    `${BASE}/api/variables/${variableId}/download`,
}
