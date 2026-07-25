import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user_data')
      localStorage.removeItem('isAuthenticated')
      if (window.location.pathname !== '/auth') {
        window.location.href = '/auth'
      }
    }
    return Promise.reject(error)
  }
)

export const personalApi = {
  list: (search?: string, page = 1, limit = 20, sortBy = 'apellidos', sortOrder = 'asc', mes?: number | string, anio?: number | string, institucion?: string, distrito?: string, rd?: string, uu?: string) => 
    api.get('/api/personal', { params: { search, page, limit, sort_by: sortBy, sort_order: sortOrder, mes, anio, institucion, distrito, rd, uu } }),
  buscar: (q: string, limit = 10) => api.get('/api/personal/buscar', { params: { q, limit } }),
  get: (id: number) => api.get(`/api/personal/${id}`),
  create: (data: any) => api.post('/api/personal', data),
  update: (id: number, data: any) => api.put(`/api/personal/${id}`, data),
  delete: (id: number) => api.delete(`/api/personal/${id}`),
  getPeriodos: (id: number) => api.get(`/api/personal/${id}/periodos`),
  exportar: (id: number, mes?: number, anio?: number) => 
    api.get(`/api/personal/${id}/exportar`, { params: { mes, anio } }),
  instituciones: (q: string) => api.get('/api/personal/instituciones', { params: { q, limit: 10 } }),
  distritos: (q: string) => api.get('/api/personal/distritos', { params: { q, limit: 10 } }),
}

export const planillasApi = {
  list: (mes?: number | string, anio?: number | string, page = 1, limit = 20, search?: string, sortBy = 'anio', sortOrder = 'desc') =>
    api.get('/api/planillas', { params: { mes, anio, page, limit, search, sort_by: sortBy, sort_order: sortOrder } }),
  get: (id: number) => api.get(`/api/planillas/${id}`),
  create: (data: any) => api.post('/api/planillas', data),
  update: (id: number, data: any) => api.put(`/api/planillas/${id}`, data),
  delete: (id: number) => api.delete(`/api/planillas/${id}`),
  editarCompleta: (id: number, data: any) => api.put(`/api/planillas/${id}/editar`, data),
}

export const ingresosApi = {
  create: (data: any) => api.post('/api/ingresos', data),
  update: (id: number, data: any) => api.put(`/api/ingresos/${id}`, data),
  delete: (id: number) => api.delete(`/api/ingresos/${id}`),
}

export const descuentosApi = {
  create: (data: any) => api.post('/api/descuentos', data),
  update: (id: number, data: any) => api.put(`/api/descuentos/${id}`, data),
  delete: (id: number) => api.delete(`/api/descuentos/${id}`),
}

export const dashboardApi = {
  getResumen: (mes?: number, anio?: number) => api.get('/api/dashboard/resumen', { params: { mes, anio } }),
}

export const importarApi = {
  validate: (file: File, edits: any[] = []) => {
    const formData = new FormData()
    formData.append('file', file)
    if (edits.length > 0) {
      formData.append('edits', JSON.stringify(edits))
    }
    return api.post('/api/validate-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
  },
  validateWithSession: (sessionId: string, edits: any[] = []) => {
    const formData = new FormData()
    formData.append('session_id', sessionId)
    if (edits.length > 0) {
      formData.append('edits', JSON.stringify(edits))
    }
    return api.post('/api/validate-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })
  },
  process: (file: File, mes: number, anio: number, edits: any[] = []) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('mes', String(mes))
    formData.append('anio', String(anio))
    formData.append('edits', JSON.stringify(edits))
    return api.post('/api/process-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    })
  },
  processWithSession: (sessionId: string, mes: number, anio: number, edits: any[] = []) => {
    const formData = new FormData()
    formData.append('session_id', sessionId)
    formData.append('mes', String(mes))
    formData.append('anio', String(anio))
    if (edits.length > 0) {
      formData.append('edits', JSON.stringify(edits))
    }
    return api.post('/api/process-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    })
  },
  limpiar: (mes: number, anio: number) =>
    api.delete('/api/importar/limpiar', { params: { mes, anio } }),
  limpiarTodo: () =>
    api.delete('/api/importar/limpiar-todo'),
  periodos: () => api.get('/api/importar/periodos'),
}

export const ocrApi = {
  scan: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/api/ocr/scan', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
  },
  scanBatch: (files: File[]) => {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    return api.post('/api/ocr/scan-batch', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    })
  },
  list: (page = 1, limit = 20) => api.get('/api/ocr/boletas', { params: { page, limit } }),
  delete: (id: number) => api.delete(`/api/ocr/boletas/${id}`),
  exportar: (params: { mes?: number; anio?: number; ids?: string }) =>
    api.get('/api/ocr/exportar', { params, responseType: 'blob' }),
}

export const exportarApi = {
  excel: (personalId: number) =>
    api.post('/api/export-excel', { personal_id: personalId }, {
      responseType: 'blob',
      timeout: 60000,
    }),
}

export const usuariosApi = {
  cambiarPassword: (passwordActual: string, nuevaPassword: string) =>
    api.put('/api/usuarios/cambiar-password', { password_actual: passwordActual, nueva_password: nuevaPassword }),
}

export default api
