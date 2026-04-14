/**
 * API client for Adaptive Learning backend.
 * Base URL: http://127.0.0.1:5000/api
 */

const API_BASE =
  import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000/api'

/* =========================
   SESSION-BASED AUTH (IMPORTANT)
   ========================= */

export function setAuth({ token, user }) {
  sessionStorage.setItem('auth', JSON.stringify({ token, user }))
}

export function getAuth() {
  const raw = sessionStorage.getItem('auth')
  return raw ? JSON.parse(raw) : null
}

export function clearAuth() {
  sessionStorage.removeItem('auth')
}

/* =========================
   CORE FETCH FUNCTION
   ========================= */

async function apiFetch(path, options = {}) {
  const {
    method = 'GET',
    body,
    token: tokenOpt,
    skipAuth = false,
    ...rest
  } = options

  const stored = getAuth()
  const token = skipAuth ? null : tokenOpt ?? stored?.token

  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData

  const headers = { ...rest.headers }

  if (token) headers.Authorization = `Bearer ${token}`

  if (!isFormData) {
    headers['Content-Type'] =
      headers['Content-Type'] || 'application/json'
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

/* =========================
   API METHODS
   ========================= */

export const api = {
  // 🔐 AUTH
  login(email, password) {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    })
  },

  //  QUESTIONS
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

  updateQuestion(id, payload) {
    return apiFetch(`/questions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: payload,
    })
  },

  deleteQuestion(id) {
    return apiFetch(`/questions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },

  // QUIZZES
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
    return apiFetch(`/quizzes/take/${encodeURIComponent(quizId)}?${q}`)
  },

  getQuizAttempts(quizId) {
    return apiFetch(`/quizzes/${encodeURIComponent(quizId)}/attempts`)
  },

  submitAttempt(payload) {
    return apiFetch('/attempts', { method: 'POST', body: payload })
  },

  //  DASHBOARD
  getStudentDashboard() {
    return apiFetch('/dashboard/student')
  },

  getTeacherDashboard() {
    return apiFetch('/dashboard/teacher')
  },

  //  DEPARTMENTS
  getDepartments() {
    return apiFetch('/quizzes/departments')
  },

  //  MATERIALS
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
    const stored = getAuth()
    const token = stored?.token

    const res = await fetch(
      `${API_BASE}/materials/${encodeURIComponent(materialId)}/file`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    )

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `Download failed (${res.status})`)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()

    URL.revokeObjectURL(url)
  },
}