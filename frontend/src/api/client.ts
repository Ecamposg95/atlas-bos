import axios from 'axios'
import { getDeviceId, getDeviceFingerprint } from '../utils/device'
import { toast } from '../store/toastStore'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Inyecta token + org context + device tracking en cada request.
// Device tracking (Track 4): permite al backend distinguir cuál PC del
// cajero hizo cada request (1 cajero opera N PCs con N impresoras).
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('atlas_token')
  const orgId = localStorage.getItem('atlas_org_id')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (orgId) {
    config.headers['X-Organization-ID'] = orgId
  }
  config.headers['X-Device-ID'] = getDeviceId()
  config.headers['X-Device-Fingerprint'] = getDeviceFingerprint()
  return config
})

// 401 → avisa al usuario, luego limpia sesión y redirige a login.
// Flag local evita un cascade de N toasts si varias requests fallan a la vez.
let sessionExpiredShown = false

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!sessionExpiredShown) {
        sessionExpiredShown = true
        toast.warning('Tu sesión expiró. Vuelve a iniciar sesión.')
      }
      setTimeout(() => {
        localStorage.removeItem('atlas_token')
        localStorage.removeItem('atlas_org_id')
        window.location.href = '/login'
      }, 1200)
    }
    return Promise.reject(error)
  }
)

export default client
