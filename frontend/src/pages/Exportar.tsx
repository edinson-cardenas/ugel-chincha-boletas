import { useState } from 'react'
import { personalApi, exportarApi } from '../services/api'
import { Search, Download, FileSpreadsheet, User, X, Hash, CheckCircle, CalendarDays, AlertCircle } from 'lucide-react'
import { useTask } from '../App'

interface Personal {
  id: number
  dni: string
  nombres: string
  apellidos: string
  puesto?: string
}

export default function Exportar() {
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<Personal[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Personal | null>(null)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searching, setSearching] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const timerRef = useState<ReturnType<typeof setTimeout> | null>(null)

  const { setProcessing } = useTask()

  const searchEmpleados = async (query: string) => {
    if (!query || query.length < 2) return
    setSearching(true)
    try {
      const res = await personalApi.buscar(query, 10)
      setSearchResults(res.data.data || [])
    } catch { setSearchResults([]) }
    setSearching(false)
  }

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (timerRef[0]) clearTimeout(timerRef[0])
    if (value.length >= 2) {
      timerRef[0] = setTimeout(() => searchEmpleados(value), 300)
    } else { setSearchResults([]) }
  }

  const selectPerson = (p: Personal) => {
    setSelectedPerson(p)
    setSearchInput(`${p.apellidos} ${p.nombres}`)
    setShowSearchResults(false)
    setSearchResults([])
    setExportError(null)
  }

  const clearSelection = () => {
    setSelectedPerson(null)
    setSearchInput('')
    setExportError(null)
  }

  const handleExport = async () => {
    if (!selectedPerson) return
    setProcessing('Generando archivo Excel...')
    setExporting(true)
    setExportError(null)
    try {
      const res = await exportarApi.excel(selectedPerson.id)
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Planilla_${selectedPerson.apellidos}_${selectedPerson.nombres}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      const msg = e.response?.data?.error || e.response?.data?.message || e.message || 'Error de conexión al exportar'
      if (e.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text()
          const err = JSON.parse(text)
          setExportError(err.error || msg)
        } catch { setExportError(msg) }
      } else {
        setExportError(msg)
      }
    } finally {
      setProcessing(null)
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Download className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-600">Exportación de Datos</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Exportar Planilla Individual</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Selecciona un empleado para exportar todas sus planillas a Excel</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Seleccionar Empleado</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Busca por nombre o número de DNI</p>
              </div>
              {selectedPerson && (
                <button onClick={clearSelection} className="ml-auto text-gray-400 hover:text-emerald-500 p-2 hover:bg-emerald-50 rounded-xl transition-all">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="relative">
              <div className={`flex items-center gap-3 w-full px-4 py-4 bg-gray-50 dark:bg-gray-700 border-2 ${selectedPerson ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-600'} rounded-xl transition-all`}>
                <div className="shrink-0">
                  {searching ? <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <Search className="w-5 h-5 text-gray-400" />}
                </div>
                <input
                  type="text"
                  className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400 text-base focus:ring-0 p-0 min-w-0"
                  placeholder="Buscar empleados por nombre o DNI..."
                  value={searchInput}
                  onChange={e => { handleSearchChange(e.target.value); setShowSearchResults(true); if (!e.target.value) setSelectedPerson(null) }}
                  onFocus={() => setShowSearchResults(true)}
                  disabled={!!selectedPerson}
                />
                {selectedPerson && (
                  <button onClick={clearSelection} className="text-emerald-500 hover:text-emerald-700 p-1.5 shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-72 overflow-y-auto">
                  {searchResults.map((p) => (
                    <button key={p.id} type="button" className="w-full text-left px-5 py-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0 flex items-center gap-4" onClick={() => selectPerson(p)}>
                      <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                        {p.nombres?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 dark:text-white">{p.apellidos} {p.nombres}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"><Hash className="w-3 h-3" /> {p.dni || 'Sin DNI'}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedPerson && (
              <div className="mt-5 p-5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl">
                    {selectedPerson.nombres?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 dark:text-white text-xl">{selectedPerson.apellidos}, {selectedPerson.nombres}</p>
                    <div className="flex flex-wrap gap-4 mt-2">
                      <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600"><Hash className="w-4 h-4 text-emerald-500" /> {selectedPerson.dni || 'Sin DNI'}</span>
                      <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">{selectedPerson.puesto || 'Sin puesto'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {exportError && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <AlertCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{exportError}</p>
            </div>
          )}

          {selectedPerson && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-3 text-lg"
            >
              {exporting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {exporting ? 'Generando archivo...' : `Exportar ${selectedPerson.apellidos} ${selectedPerson.nombres}`}
            </button>
          )}
        </div>

        <div className="space-y-5">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><FileSpreadsheet className="w-6 h-6 text-white" /></div>
              <div><h3 className="font-bold text-lg">Excel Individual</h3><p className="text-white/70 text-sm">Una sola planilla por empleado</p></div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-white/70 mt-0.5" /><p className="text-white/80">Todos los períodos del empleado</p></div>
              <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-white/70 mt-0.5" /><p className="text-white/80">Detalle de haberes y descuentos</p></div>
              <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-white/70 mt-0.5" /><p className="text-white/80">Formato automático con plantilla</p></div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-emerald-600" />Guía rápida</h3>
            <div className="space-y-3 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-start gap-2"><div className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-emerald-600 dark:text-emerald-400 font-bold">1</span></div><p>Busca al empleado por nombre o DNI</p></div>
              <div className="flex items-start gap-2"><div className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-emerald-600 dark:text-emerald-400 font-bold">2</span></div><p>Revisa los datos mostrados</p></div>
              <div className="flex items-start gap-2"><div className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-emerald-600 dark:text-emerald-400 font-bold">3</span></div><p>Haz clic en "Exportar" para descargar</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
