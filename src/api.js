// Thin fetch wrapper around the DealersOrbit backend.
// Dev: VITE_API_BASE is unset → '/api/v1', which Vite proxies to localhost:8000 (same-origin, no CORS).
// Prod: set VITE_API_BASE to the real API root (e.g. https://api.dealersorbit.com/api/v1).
const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

const TOKEN_KEY = 'do_dash_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === 'string' ? detail : detail?.detail || `Request failed (${status})`)
    this.status = status
    this.detail = detail
  }
}

async function request(method, path, { body, form, auth = true } = {}) {
  const headers = {}
  const opts = { method, headers }

  if (auth) {
    const t = getToken()
    if (t) headers['Authorization'] = `Bearer ${t}`
  }

  if (form) {
    // x-www-form-urlencoded (login uses OAuth2PasswordRequestForm)
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    opts.body = new URLSearchParams(form).toString()
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(`${API_BASE}${path}`, opts)

  let data = null
  const text = await res.text()
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }

  if (!res.ok) {
    throw new ApiError(res.status, data)
  }
  return data
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, body) => request('POST', p, { body }),
  patch: (p, body) => request('PATCH', p, { body }),
  del: (p) => request('DELETE', p),
}

// ── Auth ──
export async function login(email, password) {
  // login is unauthenticated + form-encoded (field name is `username`, expects email)
  const data = await request('POST', '/auth/login', {
    form: { username: email, password },
    auth: false,
  })
  return data.access_token
}
export const getMe = () => api.get('/auth/me')

// ── Admin ──
export const adminApi = {
  listDealerships: () => api.get('/admin/dealerships'),
  createDealership: (b) => api.post('/admin/dealerships', b),
  updateDealership: (id, b) => api.patch(`/admin/dealerships/${id}`, b),
  assignManager: (id, userId) => api.post(`/admin/dealerships/${id}/assign-manager`, { user_id: userId }),
  bulkAssign: (id, b) => api.post(`/admin/dealerships/${id}/bulk-assign`, b),
  sendWeeklyReport: (id) => api.post(`/admin/dealerships/${id}/send-weekly-report`),

  listUsers: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) qs.set(k, v)
    })
    const s = qs.toString()
    return api.get(`/admin/users${s ? `?${s}` : ''}`)
  },
  createUser: (b) => api.post('/admin/users', b),
  grantPlan: (id, b) => api.patch(`/admin/users/${id}/plan`, b),
  userActivity: (id, params = {}) => api.get(`/admin/users/${id}/activity${qs(params)}`),

  listPlatforms: (status) =>
    api.get(`/admin/dealer-platforms${status ? `?status=${status}` : ''}`),
  getPlatform: (id) => api.get(`/admin/dealer-platforms/${id}`),
  approvePlatform: (id) => api.post(`/admin/dealer-platforms/${id}/approve`),
  rejectPlatform: (id, reason) => api.post(`/admin/dealer-platforms/${id}/reject`, { reason: reason || null }),
  assignPlatform: (id, dealershipId) =>
    api.post(`/admin/dealer-platforms/${id}/assign-to-dealership`, { dealership_id: dealershipId }),
  assignPlatformToSalesperson: (id, email) =>
    api.post(`/admin/dealer-platforms/${id}/assign-to-salesperson`, { email }),

  // ── Dealer-config requests (review queue source) + Config Generator ──
  dealerConfigRequests: (status) =>
    api.get(`/admin/dealer-config-requests${status ? `?status=${status}` : ''}`),
  dealerConfigRequest: (userId) => api.get(`/admin/dealer-config-requests/${userId}`),
  generateConfig: (body) => api.post('/admin/dealer-config-generator/generate', body),
  previewConfig: (platformId) => api.post(`/admin/dealer-config-generator/${platformId}/preview`, {}),
  refineField: (platformId, body) => api.post(`/admin/dealer-config-generator/${platformId}/refine-field`, body),
  approveGeneratedConfig: (platformId, body = {}) =>
    api.post(`/admin/dealer-config-generator/${platformId}/approve`, body),

  analyticsOverview: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v) })
    const s = qs.toString()
    return api.get(`/admin/analytics/overview${s ? `?${s}` : ''}`)
  },
  analyticsCosts: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v) })
    const s = qs.toString()
    return api.get(`/admin/analytics/costs${s ? `?${s}` : ''}`)
  },
}

// ── Manager ── (all scoped server-side to the manager's own dealership; no
// dealership_id is ever sent — that's the whole point of the /manager/* design)
function qs(params = {}) {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v) s.set(k, v) })
  const out = s.toString()
  return out ? `?${out}` : ''
}

export const managerApi = {
  team: () => api.get('/manager/team'),
  teamMember: (userId, params = {}) => api.get(`/manager/team/${userId}${qs(params)}`),
  leaderboard: (since) => api.get(`/manager/leaderboard${since ? `?since=${since}` : ''}`),
  vehicles: () => api.get('/manager/vehicles'),
}
