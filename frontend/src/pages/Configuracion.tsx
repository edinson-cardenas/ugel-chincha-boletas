import { useState } from 'react'
import { User, Shield, Key, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Settings } from 'lucide-react'
import { usuariosApi } from '../services/api'

export default function Configuracion() {
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}')
  const [activeTab, setActiveTab] = useState('perfil')
  const [formData, setFormData] = useState({
    nombre: userData.nombre || 'Administrador',
    email: userData.email || 'admin@planillas.su',
  })
  const [passwords, setPasswords] = useState({
    actual: '',
    nueva: '',
    confirmar: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [passwordState, setPasswordState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [passwordError, setPasswordError] = useState('')

  const handleCambiarPassword = async () => {
    if (!passwords.actual || !passwords.nueva || !passwords.confirmar) {
      setPasswordError('Todos los campos son requeridos')
      setPasswordState('error')
      setTimeout(() => setPasswordState('idle'), 3000)
      return
    }
    if (passwords.nueva.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres')
      setPasswordState('error')
      setTimeout(() => setPasswordState('idle'), 3000)
      return
    }
    if (passwords.nueva !== passwords.confirmar) {
      setPasswordError('Las contraseñas nuevas no coinciden')
      setPasswordState('error')
      setTimeout(() => setPasswordState('idle'), 3000)
      return
    }
    setPasswordState('loading')
    try {
      await usuariosApi.cambiarPassword(passwords.actual, passwords.nueva)
      setPasswordState('success')
      setPasswords({ actual: '', nueva: '', confirmar: '' })
      setTimeout(() => setPasswordState('idle'), 3000)
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Error al cambiar la contraseña')
      setPasswordState('error')
      setTimeout(() => setPasswordState('idle'), 4000)
    }
  }

  const tabs = [
    { id: 'perfil', label: 'Perfil', icon: User },
    { id: 'seguridad', label: 'Seguridad', icon: Shield },
  ]

  return (
    <div className="min-h-screen">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-600">Administración</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h2>
        <p className="mt-1 text-gray-500 dark:text-gray-400">Personaliza tu cuenta y seguridad</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-64 rounded-2xl border overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Configuración</h3>
          </div>
          <nav className="p-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left mb-1 ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1">
          {activeTab === 'perfil' && (
            <div className="rounded-2xl border p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mi Perfil</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Información de tu cuenta</p>
                </div>
              </div>

              <div className="flex items-center gap-6 mb-6 p-4 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 rounded-xl">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  {userData.nombre?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'AD'}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">{userData.nombre || 'Administrador'}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{userData.email || 'admin@planillas.su'}</p>
                  <span className="inline-block mt-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium capitalize">
                    {userData.rol === 'admin' ? 'Administrador del Sistema' : 'Asistente'}
                  </span>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nombre Completo</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Correo Electrónico</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    disabled
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'seguridad' && (
            <div className="rounded-2xl border p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Seguridad</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cambiar contraseña de acceso al sistema</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      No contamos con recuperación por correo. Elige una contraseña segura y guárdala en un lugar seguro.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contraseña Actual</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={passwords.actual}
                      onChange={e => setPasswords({ ...passwords, actual: e.target.value })}
                      className="w-full px-4 py-3 pr-12 rounded-xl border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-600 transition-colors"
                    >
                      {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nueva Contraseña</label>
                    <input
                      type="password"
                      value={passwords.nueva}
                      onChange={e => setPasswords({ ...passwords, nueva: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirmar Contraseña</label>
                    <input
                      type="password"
                      value={passwords.confirmar}
                      onChange={e => setPasswords({ ...passwords, confirmar: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      placeholder="Repite la contraseña"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCambiarPassword}
                    disabled={passwordState === 'loading'}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {passwordState === 'loading' ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Cambiando...</>
                    ) : passwordState === 'success' ? (
                      <><CheckCircle2 className="w-5 h-5" /> Contraseña actualizada</>
                    ) : (
                      <><Key className="w-5 h-5" /> Cambiar Contraseña</>
                    )}
                  </button>
                  {passwordState === 'error' && (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                      <AlertCircle className="w-4 h-4" /> {passwordError}
                    </div>
                  )}
                  {passwordState === 'success' && (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Contraseña actualizada correctamente
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
