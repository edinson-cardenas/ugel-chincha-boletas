import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { dashboardApi } from '../services/api'
import { Activity, Users, FileSpreadsheet, Calendar, TrendingUp, TrendingDown, DollarSign, Filter, AlertTriangle, CheckCircle, X } from 'lucide-react'

const MESES = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' },
  { v: 4, l: 'Abril' }, { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' },
  { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Septiembre' },
  { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
]

const currentYear = new Date().getFullYear()
const ANIOS = Array.from({ length: currentYear - 1989 }, (_, i) => 1990 + i).reverse()

interface Resumen {
  total_personal: number
  total_planillas: number
  total_haberes: number
  total_descuentos: number
  total_liquido: number
  planillas_mes: any[]
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState<any>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ultima_importacion')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.mes === filtroMes && parsed.anio === filtroAnio) {
          setImportResult(parsed)
        }
        sessionStorage.removeItem('ultima_importacion')
      }
    } catch {}
  }, [])

  const filtroMes = searchParams.get('mes') ? Number(searchParams.get('mes')) : ''
  const filtroAnio = searchParams.get('anio') ? Number(searchParams.get('anio')) : ''

  const setFiltroMes = (v: number | '') => {
    const next = new URLSearchParams(searchParams)
    if (v === '') {
      next.delete('mes')
      next.delete('anio')
    } else {
      next.set('mes', String(v))
      if (!next.has('anio')) next.set('anio', String(new Date().getFullYear()))
    }
    setSearchParams(next, { replace: true })
  }

  const setFiltroAnio = (v: number | '') => {
    const next = new URLSearchParams(searchParams)
    if (v === '') {
      next.delete('anio')
      next.delete('mes')
    } else {
      next.set('anio', String(v))
      if (!next.has('mes')) next.set('mes', '1')
    }
    setSearchParams(next, { replace: true })
  }

  const loadData = () => {
    setLoading(true)
    setError('')
    dashboardApi.getResumen(filtroMes || undefined, filtroAnio || undefined)
      .then((res: { data: Resumen }) => setData(res.data))
      .catch((err: any) => {
        setError(err.response?.data?.error || 'Error al cargar datos del dashboard')
        setData(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [filtroMes, filtroAnio])

  const hayFiltro = filtroMes !== '' && filtroAnio !== ''
  const tituloPeriodo = hayFiltro
    ? `${MESES.find(m => m.v === filtroMes)?.l?.toUpperCase()} ${filtroAnio}`
    : new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }).toUpperCase()

  const stats = [
    { label: 'Total Personal', value: data?.total_personal || 0, icon: Users, bg: 'bg-emerald-600' },
    { label: 'Planillas Creadas', value: data?.total_planillas || 0, icon: FileSpreadsheet, bg: 'bg-gray-700' },
    { label: 'Total Haberes', value: formatCurrency(data?.total_haberes || 0), icon: TrendingUp, bg: 'bg-gray-500' },
    { label: 'Total Descuentos', value: formatCurrency(data?.total_descuentos || 0), icon: TrendingDown, bg: 'bg-gray-400' },
  ]

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-emerald-600">Panel de Control</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bienvenido de nuevo</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Resumen de tu sistema de nóminas</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, key) => (
            <div key={key} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3"></div>
                  <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{error}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-semibold text-emerald-600">Panel de Control</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bienvenido de nuevo</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Resumen de tu sistema de nóminas</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value ? Number(e.target.value) : '')}
              className="text-sm bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 font-medium cursor-pointer"
            >
              <option value="">Todos los meses</option>
              {MESES.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <select
              value={filtroAnio}
              onChange={e => setFiltroAnio(e.target.value ? Number(e.target.value) : '')}
              className="text-sm bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 font-medium cursor-pointer"
            >
              <option value="">Todos los años</option>
              {ANIOS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {hayFiltro ? 'Periodo filtrado' : 'Fecha actual'}
              </p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{tituloPeriodo}</p>
            </div>
          </div>
        </div>
      </div>

      {hayFiltro && data?.total_planillas === 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            No hay datos para el período seleccionado ({tituloPeriodo}). Todos los valores son cero.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="group bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{stat.label}</p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bg} shadow-sm group-hover:scale-105 transition-transform`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
                <FileSpreadsheet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {importResult ? 'Importación Exitosa' : (hayFiltro ? 'Planillas del Periodo' : 'Todas las Planillas')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {importResult ? `${importResult.total} registros importados` : `${data?.planillas_mes?.length || 0} registros`}
                </p>
              </div>
            </div>
            {importResult && (
              <button onClick={() => setImportResult(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-all">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {importResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                  Datos importados correctamente para {MESES.find(m => m.v === importResult.mes)?.l} {importResult.anio}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{importResult.total}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Registros</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{importResult.duplicados}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Descartados</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    S/ {Number(importResult.monto || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Monto Total</p>
                </div>
              </div>
              {importResult.duplicados > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Se descartaron {importResult.duplicados} registros por tener DNI y nombre duplicado.
                </div>
              )}
            </div>
          ) : data?.planillas_mes && data.planillas_mes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4">Empleado</th>
                    <th className="text-left py-3 px-4">DNI</th>
                    <th className="text-right py-3 px-4">Haberes</th>
                    <th className="text-right py-3 px-4">Descuentos</th>
                    <th className="text-right py-3 px-4">Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {data.planillas_mes.slice(0, 10).map((p: any) => (
                    <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            {p.personal?.nombres?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{p.personal?.apellidos} {p.personal?.nombres}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{p.personal?.puesto || 'Sin puesto'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg text-gray-700 dark:text-gray-300">{p.personal?.dni || '-'}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(p.total_haberes)}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-gray-500 dark:text-gray-400">{formatCurrency(p.total_descuentos)}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm shadow-sm">
                          {formatCurrency(p.total_liquido)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {hayFiltro ? 'Sin datos para este período' : 'Sin planillas registradas'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {hayFiltro
                  ? 'No hay planillas en el período seleccionado'
                  : 'Importa un archivo Excel para comenzar'}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{hayFiltro ? 'Resumen del Periodo' : 'Resumen Total'}</h3>
                <p className="text-white/70 text-sm">{tituloPeriodo}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 px-4 bg-white/10 rounded-xl">
                <span className="text-white/80">Pago Líquido Total</span>
                <span className="font-bold text-xl">{formatCurrency(data?.total_liquido || 0)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{data?.total_personal || 0}</p>
                  <p className="text-xs text-white/70">Empleados</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{data?.total_planillas || 0}</p>
                  <p className="text-xs text-white/70">Planillas</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h4 className="font-bold text-gray-900 dark:text-white mb-4">Resumen Financiero</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Haberes</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(data?.total_haberes || 0)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Descuentos</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(data?.total_descuentos || 0)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Líquido a Pagar</span>
                </div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(data?.total_liquido || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value)
}
