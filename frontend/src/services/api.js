/**
 * API client for Adaptive Learning backend.
 * Base URL: http://127.0.0.1:5000/api (override with VITE_API_BASE in .env)
 */

const API_BASE =
  import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000/api'

let memoryAuthToken = null

export function setAuthToken(token) {
  memoryAuthToken = token || null
}

export function getAuth() {
  return memoryAuthToken ? { token: memoryAuthToken } : null
}

export function setAuth({ token }) {
  setAuthToken(token)
}

export function clearAuth() {
  setAuthToken(null)
}

async function apiFetch(path, options = {}) {
  const {
    method = 'GET',
    body,
    token: tokenOpt,
    skipAuth = false,
    ...rest
  } = options
  const token = skipAuth ? null : tokenOpt ?? memoryAuthToken
  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData
  const headers = { ...rest.headers }
  if (token) headers.Authorization = `Bearer ${token}`
  if (!isFormData) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : isFormData
          ? body
          : JSON.stringify(body),
    ...rest,
  })

  if (res.status === 204) {
    if (!res.ok) {
      const err = new Error(`Request failed (${res.status})`)
      err.status = res.status
      throw err
    }
    return null
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  login(email, password) {
    return apiFetch('/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    })
  },

  adminLogin(email, password) {
    return apiFetch('/admin/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    })
  },

  adminGetStats() {
    return apiFetch('/admin/stats')
  },

  adminGetUsers(role) {
    return apiFetch(`/admin/users/${encodeURIComponent(role)}`)
  },

  adminCreateUser(payload) {
    return apiFetch('/admin/users', { method: 'POST', body: payload })
  },

  adminUpdateUser(userId, payload) {
    return apiFetch(`/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: payload,
    })
  },

  adminDeleteUser(userId) {
    return apiFetch(`/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })
  },

  adminResetPassword(userId, new_password) {
    return apiFetch(`/admin/users/${encodeURIComponent(userId)}/reset-password`, {
      method: 'PATCH',
      body: { new_password },
    })
  },

  getQuestions(params = {}) {
    const q = new URLSearchParams()
    if (params.subject) q.set('subject', params.subject)
    if (params.topic) q.set('topic', params.topic)
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return apiFetch(`/questions${suffix}`)
  },

  createQuestion(payload) {
    return apiFetch('/questions', { method: 'POST', body: payload })
  },

  updateQuestion(questionId, payload) {
    return apiFetch(`/questions/${encodeURIComponent(questionId)}`, {
      method: 'PUT',
      body: payload,
    })
  },

  deleteQuestion(questionId) {
    return apiFetch(`/questions/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    })
  },

  getQuizzes() {
    return apiFetch('/quizzes')
  },

  createQuiz(payload) {
    return apiFetch('/quizzes', { method: 'POST', body: payload })
  },

  assignQuiz(payload) {
    return apiFetch('/quizzes/assign', { method: 'POST', body: payload })
  },

  getAssignedQuizzes() {
    return apiFetch('/quizzes/assigned')
  },

  getQuizForAttempt(quizId, assignmentId) {
    const q = new URLSearchParams({ assignment_id: assignmentId })
    return apiFetch(`/quizzes/take/${encodeURIComponent(quizId)}?${q.toString()}`)
  },

  getQuizAttempts(quizId) {
    return apiFetch(`/quizzes/${encodeURIComponent(quizId)}/attempts`)
  },

  submitAttempt(payload) {
    return apiFetch('/attempts', { method: 'POST', body: payload })
  },

  getStudentDashboard() {
    return apiFetch('/dashboard/student')
  },

  getTeacherDashboard() {
    return apiFetch('/dashboard/teacher')
  },

  getStudentProgress() {
    return apiFetch('/dashboard/teacher/students')
  },

  getDepartments() {
    return apiFetch('/quizzes/departments')
  },

  getMaterials(params = {}) {
    const q = new URLSearchParams()
    if (params.department) q.set('department', params.department)
    if (params.topic) q.set('topic', params.topic)
    if (params.difficulty) q.set('difficulty', params.difficulty)
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return apiFetch(`/materials${suffix}`)
  },

  createMaterial(payload) {
    return apiFetch('/materials', { method: 'POST', body: payload })
  },

  getRecommendedMaterials() {
    return apiFetch('/materials/recommended')
  },

  async downloadMaterialFile(materialId, filename = 'material.pdf') {
    const token = memoryAuthToken
    const res = await fetch(
      `${API_BASE}/materials/${encodeURIComponent(materialId)}/file`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    )
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      const err = new Error(errData.error || `Download failed (${res.status})`)
      err.status = res.status
      throw err
    }
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    const name =
      filename.endsWith('.pdf') ? filename : `${filename.replace(/\.+$/, '')}.pdf`
    a.download = name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  },
}

export function getMaterials(params) {
  return api.getMaterials(params)
}

export function createMaterial(data) {
  return api.createMaterial(data)
}

export function getRecommendedMaterials() {
  return api.getRecommendedMaterials()
}