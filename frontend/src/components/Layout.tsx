import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, FileSpreadsheet, Upload, Download, Scan, Menu, LogOut, ChevronDown, Loader2, Settings } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useAuth, useTask } from '../App'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', desc: 'Resumen general' },
  { to: '/planillas', icon: Users, label: 'Planillas', desc: 'Personal docente' },
  { to: '/importar', icon: Upload, label: 'Importar', desc: 'Importar datos' },
  { to: '/escanear', icon: Scan, label: 'Escanear', desc: 'Escanear boletas' },
  { to: '/exportar', icon: Download, label: 'Exportar', desc: 'Exportar planillas' },
  { to: '/configuracion', icon: Settings, label: 'Configuración', desc: 'Ajustes del sistema' },
]

export default function Layout() {
  const { logout } = useAuth()
  const { isProcessing } = useTask()
  const navigate = useNavigate()
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      setSidebarVisible(!mobile)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}')
  const userName = currentUser.nombre || 'Administrador'
  const userEmail = currentUser.email || 'admin@planillas.su'
  const userRole = currentUser.rol === 'admin' ? 'Administrador' : 'Asistente'
  const userInitials = userName.split(' ').map((n: string) => n.charAt(0)).join('').substring(0, 2).toUpperCase()

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
    localStorage.removeItem('isAuthenticated')
    logout()
    navigate('/auth')
  }

  const currentPage = navItems.find(n => window.location.pathname === n.to)?.label || 'Dashboard'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <aside className={`fixed inset-y-0 left-0 z-50 transition-all duration-300 ${sidebarVisible ? 'w-72' : 'w-0'} overflow-hidden bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg`}>
        <div className="flex flex-col h-full w-72">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
                  <FileSpreadsheet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sistema de Gestión de Planillas</h1>
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${isActive ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{item.label}</p>
                      <p className={`text-xs ${isActive ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'}`}>{item.desc}</p>
                    </div>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      <div className={`transition-all duration-300 ${sidebarVisible ? 'lg:ml-72' : ''}`}>
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between px-6 h-16">
            <div className="flex items-center gap-4">
              {isMobile && (
                <button onClick={() => setSidebarVisible(!sidebarVisible)} className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{currentPage}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 pl-2 rounded-xl py-2 pr-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              >
                <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {userInitials}
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{userName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{userRole}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-xl border overflow-hidden z-50 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{userName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{userEmail}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-medium">Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {isMobile && sidebarVisible && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden" onClick={() => setSidebarVisible(false)}>
          <div className="absolute inset-y-0 left-0 w-72" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl px-8 py-6 flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            <span className="text-gray-900 dark:text-white font-medium">{isProcessing}</span>
          </div>
        </div>
      )}
    </div>
  )
}