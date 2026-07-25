import { useState } from 'react'
import { useAuth } from '../App'
import { AlertCircle, Eye, EyeOff, Loader2, CheckCircle, ChevronRight, Lock, Mail, Shield, Zap, FileSpreadsheet } from 'lucide-react'
import api from '../services/api'

export default function Auth() {
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [step, setStep] = useState<'form' | 'loading' | 'success'>('form')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {}
    if (!formData.email.trim()) errors.email = 'El correo es requerido'
    else if (!validateEmail(formData.email)) errors.email = 'Correo inválido'
    if (!formData.password) errors.password = 'La contraseña es requerida'
    else if (formData.password.length < 4) errors.password = 'Mínimo 4 caracteres'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validateForm()) return

    setStep('loading')
    setIsLoading(true)

    try {
      const response = await api.post('/api/usuarios/login', { email: formData.email, password: formData.password })
      if (response.data.token) {
        // Guardar solo datos de usuario en localStorage (no el token, viaja en cookie httpOnly)
        localStorage.setItem('user_data', JSON.stringify(response.data.user || {}))
        setStep('success')
        setTimeout(() => login(), 1200)
      }
    } catch (err: any) {
      setStep('form')
      setError(err.response?.data?.error || 'Credenciales incorrectas. Intenta de nuevo.')
    } finally { setIsLoading(false) }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="relative z-10 text-center max-w-md w-full px-6">
          <div className="w-32 h-32 rounded-3xl bg-emerald-600 flex items-center justify-center shadow-2xl mx-auto mb-8">
            <FileSpreadsheet className="w-16 h-16 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Verificando acceso</h2>
          <p className="text-gray-400 mb-8">Validando credenciales de usuario</p>
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            <span className="text-emerald-500 font-medium">Por favor espera</span>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="relative z-10 text-center max-w-md w-full px-6">
          <div className="w-32 h-32 rounded-3xl bg-green-500 flex items-center justify-center shadow-2xl mx-auto mb-8">
            <CheckCircle className="w-16 h-16 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">¡Bienvenido!</h2>
          <p className="text-green-400">Acceso concedido. Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-20%] right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px]"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-center p-16 w-full max-w-2xl mx-auto">
          <div className="mb-12">
            <div className="flex flex-col items-center text-center mb-8">
              <img src="/logo.svg" alt="Planillas SU" className="w-72 h-auto mb-6 opacity-90" />
              <h1 className="text-4xl font-bold text-white tracking-tight">Sistema de Gestión de Planillas</h1>
            </div>
          </div>

          <div className="space-y-5">
            {[
              { icon: Zap, title: 'Gestión Integral', desc: 'Administra personal, planillas y pagos en un solo lugar', color: 'from-emerald-600 to-emerald-700' },
              { icon: FileSpreadsheet, title: 'Importación Masiva', desc: 'Importa datos desde Excel de forma rápida y segura', color: 'from-gray-600 to-gray-700' },
              { icon: Shield, title: 'Reportes Detallados', desc: 'Genera reportes y estadísticas en tiempo real', color: 'from-gray-500 to-gray-600' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-5 p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/10 transition-all group">
                <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <div className="pt-1">
                  <h3 className="text-lg font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 bg-gray-50">
        <div className="relative z-10 w-full max-w-md">
          <div className="lg:hidden text-center mb-10">
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-xl mx-auto mb-4">
              <FileSpreadsheet className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Sistema de Gestión de Planillas</h1>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Bienvenido de nuevo</h2>
            <p className="text-gray-500">Ingresa tus credenciales para acceder al sistema</p>
          </div>

          {error && (
            <div className="mb-8 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-emerald-700 font-medium flex-1">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2.5 ml-1">Correo electrónico</label>
              <div className={`flex items-center gap-3 w-full px-4 py-4 bg-white border-2 ${fieldErrors.email ? 'border-emerald-300 bg-emerald-50' : focusedField === 'email' ? 'border-emerald-400 shadow-lg' : 'border-gray-200 bg-gray-50'} rounded-2xl transition-all`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${focusedField === 'email' ? 'bg-emerald-600 shadow-lg' : 'bg-gray-100'}`}>
                  <Mail className={`w-5 h-5 transition-colors ${focusedField === 'email' ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <input
                  type="email"
                  className="flex-1 bg-transparent border-none outline-none text-gray-800 placeholder-gray-400 text-base focus:ring-0 p-0 min-w-0"
                  placeholder="correo@ejemplo.com"
                  value={formData.email}
                  onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setFieldErrors({ ...fieldErrors, email: undefined }); setError('') }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              {fieldErrors.email && <p className="mt-2.5 text-sm text-emerald-600 font-medium ml-1">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2.5 ml-1">Contraseña</label>
              <div className={`flex items-center gap-3 w-full px-4 py-4 bg-white border-2 ${fieldErrors.password ? 'border-emerald-300 bg-emerald-50' : focusedField === 'password' ? 'border-emerald-400 shadow-lg' : 'border-gray-200 bg-gray-50'} rounded-2xl transition-all`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${focusedField === 'password' ? 'bg-emerald-600 shadow-lg' : 'bg-gray-100'}`}>
                  <Lock className={`w-5 h-5 transition-colors ${focusedField === 'password' ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="flex-1 bg-transparent border-none outline-none text-gray-800 placeholder-gray-400 text-base focus:ring-0 p-0 min-w-0"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setFieldErrors({ ...fieldErrors, password: undefined }); setError('') }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-gray-400 hover:text-emerald-600 transition-colors p-1.5 hover:bg-emerald-50 rounded-lg shrink-0">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {fieldErrors.password && <p className="mt-2.5 text-sm text-emerald-600 font-medium ml-1">{fieldErrors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all duration-300 flex items-center justify-center gap-3 text-base disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Verificando...</span></> : <><span>Iniciar Sesión</span><ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
            </button>
          </form>

          <div className="mt-8 p-6 bg-gray-100 rounded-2xl border border-gray-200">
            <p className="text-sm text-gray-500 font-medium text-center">
              ¿Problemas de acceso? Contacta al administrador del sistema
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-400">© {new Date().getFullYear()} Planillas SU — Todos los derechos reservados</p>
          </div>
        </div>
      </div>
    </div>
  )
}