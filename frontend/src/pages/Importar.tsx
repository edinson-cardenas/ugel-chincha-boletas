import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileSpreadsheet, AlertCircle, HelpCircle, AlertTriangle, Calendar, Pencil, Trash2, ChevronDown, Loader2 } from 'lucide-react'
import { importarApi } from '../services/api'
import { useTask } from '../App'

const MESES = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' },
  { v: 4, l: 'Abril' }, { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' },
  { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Septiembre' },
  { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
]

const currentYear = new Date().getFullYear()
const ANIOS = Array.from({ length: currentYear - 1989 }, (_, i) => 1990 + i).reverse()

export default function Importar() {
  const navigate = useNavigate()
  const { setProcessing } = useTask()
  const [file, setFile] = useState<File | null>(null)
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1)
  const [anio, setAnio] = useState<number>(currentYear)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [validacion, setValidacion] = useState<any>(null)
  const [periodosImportados, setPeriodosImportados] = useState<any[]>([])
  const [lockPeriodo, setLockPeriodo] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [editDuplicados, setEditDuplicados] = useState<Record<string, { dni: string; nombre: string }>>({})
  const [empleadosRaw, setEmpleadosRaw] = useState<any[]>([])
  const [personalCache, setPersonalCache] = useState<{ by_dni: Record<string, number>; by_name: Record<string, number> }>({ by_dni: {}, by_name: {} })
  const [showLimpiar, setShowLimpiar] = useState(false)
  const [limpiarMes, setLimpiarMes] = useState(0)
  const [limpiarAnio, setLimpiarAnio] = useState(0)
  const [limpiando, setLimpiando] = useState(false)
  const [cleanError, setCleanError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const normalizeKey = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')

  const localAnalyze = (emps: any[]) => {
    // Group by DNI first
    const byDNI: Record<string, { idx: number; dni: string; nombre: string }[]> = {}
    const noMatchDNI: { idx: number; dni: string; nombre: string }[] = []
    for (let i = 0; i < emps.length; i++) {
      const e = emps[i]
      if (!e.dni) { noMatchDNI.push(e); continue }
      if (!byDNI[e.dni]) byDNI[e.dni] = []
      byDNI[e.dni].push(e)
    }
    const duplicadosDNI: any[] = []
    const exactos: number[] = []
    for (const dni of Object.keys(byDNI)) {
      const group = byDNI[dni]
      if (group.length > 1) {
        // Within same DNI, group by normalized name
        const byName: Record<string, typeof group> = {}
        for (const emp of group) {
          const key = normalizeKey(emp.nombre || '')
          if (!byName[key]) byName[key] = []
          byName[key].push(emp)
        }
        const empleadosList: any[] = []
        for (const nameKey of Object.keys(byName)) {
          const nameGroup = byName[nameKey]
          for (let j = 0; j < nameGroup.length; j++) {
            const emp = nameGroup[j]
            const isOriginal = j === 0
            empleadosList.push({
              idx: emp.idx,
              dni: dni,
              nombre: emp.nombre || '',
              original: isOriginal,
            })
            if (!isOriginal) exactos.push(emp.idx)
          }
        }
        duplicadosDNI.push({ dni, empleados: empleadosList })
      }
    }
    for (const emp of noMatchDNI) {
      duplicadosDNI.push({ dni: '', empleados: [{ idx: emp.idx, dni: '', nombre: emp.nombre || '', original: true }] })
    }
    const singleByGroup = (empsByDNI: typeof byDNI) => {
      const singles: number[] = []
      for (const dni of Object.keys(empsByDNI)) {
        const group = empsByDNI[dni]
        if (group.length === 1) singles.push(group[0].idx)
      }
      return singles
    }
    return { duplicadosDNI, exactos, singles: singleByGroup(byDNI) }
  }

  const localEstimate = (emps: any[], pc: typeof personalCache) => {
    const matched = new Set<number>()
    let unmatched = 0
    for (const emp of emps) {
      if (!emp.nombre) continue
      let pid: number | undefined
      if (emp.dni) pid = pc.by_dni[emp.dni]
      if (!pid) pid = pc.by_name[normalizeKey(emp.nombre)]
      if (pid) matched.add(pid)
      else unmatched++
    }
    return matched.size + unmatched
  }

  const recalc = (edits: Record<string, { dni: string; nombre: string }>) => {
    if (!empleadosRaw.length) return
    const emps = empleadosRaw.map(e => ({ ...e }))
    for (const [key, val] of Object.entries(edits)) {
      const idx = parseInt(key.replace('idx_', ''))
      if (emps[idx]) {
        if (val.dni !== undefined) emps[idx].dni = val.dni
        if (val.nombre !== undefined) emps[idx].nombre = val.nombre
      }
    }
    const { duplicadosDNI, exactos } = localAnalyze(emps)
    const exactosSet = new Set(exactos)
    const filtrados = emps.filter((_: any, i: number) => !exactosSet.has(i))
    const planillas = localEstimate(filtrados, personalCache)
    setValidacion((prev: any) => prev ? {
      ...prev,
      dnis_duplicados: duplicadosDNI,
      exactos: exactos.length,
      exactos_indices: exactos,
      a_importar: emps.length - exactos.length,
      planillas_estimadas: planillas,
      monto_total: filtrados.reduce((s: number, e: any) => s + (e.total_liquido || 0), 0),
    } : prev)
    setEditDuplicados(prev => {
      let changed = false
      const next = { ...prev }
      for (const idx of exactos) {
        const key = `idx_${idx}`
        if (!next[key]) {
          const emp = empleadosRaw[idx]
          next[key] = { dni: emp?.dni || '', nombre: emp?.nombre || '' }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }

  const handleEditDuplicado = (key: string, field: 'dni' | 'nombre', value: string) => {
    if (!editDuplicados[key]) return
    const updated = { ...editDuplicados, [key]: { ...editDuplicados[key], [field]: value } }
    setEditDuplicados(updated)
    recalc(updated)
  }

  useEffect(() => {
    importarApi.periodos().then(res => {
      setPeriodosImportados(res.data.periodos || [])
    }).catch(() => {})
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) acceptFile(selected)
  }

  const acceptFile = (f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setError('Solo archivos Excel (.xlsx, .xls)')
      return
    }
    setFile(f)
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) acceptFile(f)
  }

  const handleValidate = async () => {
    if (!file) return
    setUploading(true)
    setIsLoading(true)
    setError(null)
    setValidacion(null)
    setProcessing('Validando archivo...')

    try {
      const res = await importarApi.validate(file)
      const data = res.data
      setValidacion(data)
      setSessionId(data.session_id || null)
      setEmpleadosRaw(data.empleados || [])
      setPersonalCache(data.personal_cache || { by_dni: {}, by_name: {} })
      const exactosSet = new Set(data.exactos_indices || [])
      const edits: Record<string, { dni: string; nombre: string }> = {}
      ;(data.dnis_duplicados || []).forEach((item: any) => {
        (item.empleados || []).forEach((emp: any) => {
          if (exactosSet.has(emp.idx)) {
            edits[`idx_${emp.idx}`] = { dni: item.dni || '', nombre: emp.nombre || '' }
          }
        })
      })
      setEditDuplicados(edits)
      recalc(edits)
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Error del servidor'
      setError(msg)
    } finally {
      setProcessing(null)
      setUploading(false)
      setIsLoading(false)
    }
  }

  const handleConfirmUpload = async () => {
    if (!file) return
    setProcessing('Importando datos...')
    setUploading(true)
    setIsLoading(true)
    setValidacion(null)

    try {
      const editsArray = Object.entries(editDuplicados).map(([key, val]) => ({
        idx: parseInt(key.replace('idx_', '')),
        dni: val.dni,
        nombre: val.nombre,
      }))
      const res = sessionId
        ? await importarApi.processWithSession(sessionId, mes, anio, editsArray)
        : await importarApi.process(file, mes, anio, editsArray)
      const result = res.data
      sessionStorage.setItem('ultima_importacion', JSON.stringify({
        mes,
        anio,
        total: result.planillas_creadas || 0,
        duplicados: result.exactos || 0,
        monto: result.monto_total || 0,
        timestamp: Date.now()
      }))
      navigate(`/?mes=${mes}&anio=${anio}`)
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Error del servidor'
      setError(msg)
    } finally {
      setProcessing(null)
      setUploading(false)
      setIsLoading(false)
    }
  }

  const handleCancelValidation = () => {
    setValidacion(null)
  }

  const resetForm = () => {
    setFile(null)
    setError(null)
    setValidacion(null)
    setLockPeriodo(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const periodoYaImportado = periodosImportados.some((p: any) => p.mes === mes && p.anio === anio)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Upload className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-600">Importación de Datos</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Importar Planilla</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Carga archivos Excel para importar nóminas masivamente</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-5">
                <div className="skeleton w-10 h-10 rounded-xl"></div>
                <div>
                  <div className="skeleton skeleton-text w-32"></div>
                  <div className="skeleton skeleton-text w-24"></div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="skeleton w-full h-12 rounded-xl"></div>
                <div className="skeleton w-full h-12 rounded-xl"></div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="skeleton skeleton-card rounded-xl h-40"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const mesNombre = MESES.find(m => m.v === mes)?.l ?? ''

  const totalEncontrados = validacion?.total_empleados || 0
  const aImportar = validacion?.planillas_estimadas ?? validacion?.a_importar ?? totalEncontrados
  const exactosFinal = validacion?.exactos || 0

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Upload className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-600">Importación de Datos</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Importar Planilla</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Carga archivos Excel para importar nóminas masivamente</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-gray-600 rounded-xl">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">1. Seleccionar Período</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Mes y año de la planilla</p>
              </div>
            </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Mes</label>
                  <select value={mes} onChange={e => setMes(Number(e.target.value))} disabled={lockPeriodo} className="input">
                    {MESES.map(m => (<option key={m.v} value={m.v}>{m.l}</option>))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Año</label>
                  <select value={anio} onChange={e => setAnio(Number(e.target.value))} disabled={lockPeriodo} className="input">
                    {ANIOS.map(y => (<option key={y} value={y}>{y}</option>))}
                  </select>
                </div>
              </div>
              {periodoYaImportado && (
                <div className="mt-3 flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    Este período ya fue importado. Usa "Limpiar Importación" si deseas reimportarlo.
                  </span>
                </div>
              )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-emerald-600 rounded-xl">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">2. Subir Archivo</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Arrastra el archivo o haz clic para seleccionar</p>
              </div>
            </div>

            <div
              className={`upload-zone ${dragging ? 'upload-zone-active' : file ? 'border-emerald-300 bg-emerald-50' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
              {file ? (
                <div className="flex items-center justify-center gap-5">
                  <div className="w-14 h-14 bg-gray-600 rounded-2xl flex items-center justify-center">
                    <FileSpreadsheet className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{file.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(1)} KB - {mesNombre} {anio}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">Arrastra el archivo aquí</p>
                  <p className="text-sm text-gray-400">o haz clic para seleccionar - .xlsx, .xls</p>
                </div>
              )}
            </div>

            {error && (
              <div className="alert-error mt-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>

          {validacion && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border-2 border-amber-300 dark:border-amber-600">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400">Vista Previa - Resumen de Datos</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {exactosFinal > 0
                      ? `Se detectaron ${totalEncontrados} empleados. ${exactosFinal} duplicados exactos serán descartados (puedes editarlos abajo para conservarlos). Quedan ${aImportar} por importar.`
                      : 'No se encontraron duplicados. Los datos están listos para importar.'}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalEncontrados}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Encontrados</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{exactosFinal}</p>
                  <p className="text-xs leading-tight text-amber-600 dark:text-amber-400">
                    Duplicados exactos
                    <span className="block text-[10px] opacity-80">(mismo DNI+nombre, se descartan)</span>
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{aImportar}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">A importar</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">S/ {Number(validacion.monto_total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Monto Total</p>
                </div>
              </div>

              {Object.keys(editDuplicados).length > 0 && (validacion.exactos_indices?.length ?? 0) > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Pencil className="w-4 h-4 text-amber-600" />
                    <p className="font-medium text-amber-800 dark:text-amber-300">Editar registros duplicados:</p>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(editDuplicados).filter(([key]) => (validacion.exactos_indices || []).includes(parseInt(key.replace('idx_', '')))).map(([key, val]) => {
                      const empIdx = parseInt(key.replace('idx_', ''))
                      const allEmpleados = (validacion.dnis_duplicados || []).flatMap((d: any) => d.empleados || [])
                      const emp = allEmpleados.find((e: any) => e.idx === empIdx)
                      return (
                        <div key={key} className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 text-sm border border-amber-200 dark:border-amber-700">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium">DNI</label>
                              <input
                                type="text"
                                value={val.dni}
                                onChange={e => handleEditDuplicado(key, 'dni', e.target.value)}
                                className="w-full px-2 py-1 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-600 rounded text-xs focus:outline-none focus:border-amber-500 text-gray-900 dark:text-white mt-0.5"
                                maxLength={8}
                              />
                            </div>
                            <div className="flex-[2]">
                              <label className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium">Nombre</label>
                              <input
                                type="text"
                                value={val.nombre}
                                onChange={e => handleEditDuplicado(key, 'nombre', e.target.value)}
                                className="w-full px-2 py-1 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-600 rounded text-xs focus:outline-none focus:border-amber-500 text-gray-900 dark:text-white mt-0.5"
                              />
                            </div>
                            {emp && (
                              <div className="text-right shrink-0">
                                <label className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium">Monto</label>
                                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mt-1">
                                  S/ {Number(emp.monto || 0).toFixed(2)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {periodoYaImportado ? (
                <div className="flex flex-col gap-3 mt-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Este período ({mesNombre} {anio}) ya fue importado anteriormente. Usa la sección "Limpiar Importación" a la derecha para eliminarlo y reimportarlo.
                    </p>
                  </div>
                  <button onClick={handleCancelValidation} className="btn-secondary">Cancelar</button>
                </div>
              ) : (
                <div className="flex gap-3 mt-4">
                  <button onClick={handleCancelValidation} className="btn-secondary flex-1">Cancelar</button>
                  <button onClick={handleConfirmUpload} disabled={uploading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    {uploading ? (
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploading
                      ? 'Importando...'
                      : `Importar ${aImportar} registros`}
                  </button>
                </div>
              )}
            </div>
          )}

          {!validacion && (
            <>
              {file && (
                <div className="flex gap-3 mt-4">
                  <button onClick={resetForm} className="btn-secondary">Limpiar</button>
                  <button onClick={handleValidate} disabled={!file || uploading} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                    {uploading ? (
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploading ? 'Procesando...' : `Procesar - ${mesNombre} ${anio}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => setShowLimpiar(!showLimpiar)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600 rounded-xl">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Limpiar Importación</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Elimina planillas de un período</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {periodosImportados.length > 0 && (
                  <span className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full font-medium">
                    {periodosImportados.length} período{periodosImportados.length !== 1 ? 's' : ''}
                  </span>
                )}
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showLimpiar ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {showLimpiar && (
              <div className="px-5 pb-5 space-y-4">
                {periodosImportados.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Períodos con importaciones</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {periodosImportados.map((p: any) => (
                            <button
                              key={`${p.mes}-${p.anio}`}
                              onClick={() => { setLimpiarMes(p.mes); setLimpiarAnio(p.anio) }}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                                limpiarMes === p.mes && limpiarAnio === p.anio
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                              }`}
                            >
                              {MESES.find((m: any) => m.v === p.mes)?.l?.substring(0, 3)} {p.anio}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Mes</label>
                    <select
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-900 dark:text-white"
                      value={limpiarMes}
                      onChange={e => setLimpiarMes(Number(e.target.value))}
                    >
                      <option value={0}>Seleccionar mes</option>
                      {MESES.filter(m => m).map((m: any) => (
                        <option key={m.v} value={m.v}>{m.l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Año</label>
                    <select
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-900 dark:text-white"
                      value={limpiarAnio}
                      onChange={e => setLimpiarAnio(Number(e.target.value))}
                    >
                      <option value={0}>Seleccionar año</option>
                      {ANIOS.map((a: number) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">¿Estás seguro?</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                        Esta acción eliminará TODAS las planillas, ingresos y descuentos del período seleccionado ({MESES.find((m: any) => m.v === limpiarMes)?.l || '...'} {limpiarAnio || '...'}). Los empleados sin planillas en otros períodos también serán eliminados.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (!limpiarMes || !limpiarAnio) return
                    setProcessing('Limpiando importación...')
                    setLimpiando(true)
                    setCleanError(null)
                    try {
                      await importarApi.limpiar(limpiarMes, limpiarAnio)
                      setLimpiarMes(0)
                      setLimpiarAnio(0)
                      const res = await importarApi.periodos()
                      setPeriodosImportados(res.data.periodos || [])
                    } catch (err: any) {
                      setCleanError(err.response?.data?.error || err.message || 'Error al limpiar')
                    } finally {
                      setProcessing(null)
                      setLimpiando(false)
                    }
                  }}
                  disabled={limpiando || !limpiarMes || !limpiarAnio}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {limpiando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {limpiando ? 'Limpiando...' : `Limpiar ${MESES.find((m: any) => m.v === limpiarMes)?.l || ''} ${limpiarAnio || ''}`}
                </button>

                {cleanError && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-400">{cleanError}</span>
                  </div>
                )}

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-emerald-600" />
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Zona de Peligro</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Elimina TODOS los datos del sistema (personal, planillas, ingresos y descuentos). Esta acción no se puede deshacer.
                  </p>
                  <button
                    onClick={async () => {
                      if (!window.confirm('¿Estás seguro de eliminar TODOS los datos? Esta acción eliminará personal, planillas, ingresos y descuentos permanentemente.')) return
                      setProcessing('Eliminando todos los datos...')
                      setLimpiando(true)
                      setCleanError(null)
                      try {
                        await importarApi.limpiarTodo()
                        setLimpiarMes(0)
                        setLimpiarAnio(0)
                        const res = await importarApi.periodos()
                        setPeriodosImportados(res.data.periodos || [])
                      } catch (err: any) {
                        setCleanError(err.response?.data?.error || err.message || 'Error al limpiar')
                      } finally {
                        setProcessing(null)
                        setLimpiando(false)
                      }
                    }}
                    disabled={limpiando}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    {limpiando ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {limpiando ? 'Eliminando...' : 'Eliminar todos los datos'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gray-600 rounded-xl">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Estructura de Datos</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nombre', desc: 'Col B - Fila HABERES' },
                { label: 'Institución', desc: 'Col B - Fila arriba de HABERES' },
                { label: 'Distrito', desc: 'Col B - Debajo del nombre (opcional)' },
                { label: 'Puesto', desc: 'Col B - Después del nombre' },
                { label: 'DNI', desc: 'Col B - DNI' },
                { label: 'Ingresos', desc: 'Sección HABERES (Col C)' },
                { label: 'Descuentos', desc: 'Sección DSCTOS (Col C)' },
              ].map(({ label, desc }, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}