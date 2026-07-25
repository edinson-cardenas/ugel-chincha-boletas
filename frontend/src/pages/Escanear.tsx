import { useState, useRef, useCallback } from 'react'
import { Scan, FileSpreadsheet, Download, Eye, AlertTriangle, CheckCircle, Loader2, Image, FileImage, X } from 'lucide-react'
import api from '../services/api'

interface BoletaResult {
  id?: number
  nombre_completo: string
  codigo_modular: string
  institucion: string
  nivel: string
  anio: number
  mes: number
  total_haberes: number
  total_descuentos: number
  total_liquido: number
  ocr_engine: string
  ocr_confidence: number
  haberes?: any[]
  descuentos?: any[]
}

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function Escanear() {
  const [files, setFiles] = useState<File[]>([])
  const [results, setResults] = useState<BoletaResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dragging, setDragging] = useState(false)
  const [selectedResult, setSelectedResult] = useState<BoletaResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return
    const imgFiles = Array.from(newFiles).filter(f => f.type.startsWith('image/'))
    setFiles(prev => [...prev, ...imgFiles])
    setError('')
    setSuccess('')
  }, [])

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleScan = async () => {
    if (files.length === 0) {
      setError('Selecciona al menos una imagen para escanear')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')
    setResults([])

    const formData = new FormData()
    files.forEach(f => formData.append('files', f))

    try {
      const res = await api.post('/api/ocr/scan-batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      })
      setResults(res.data.boletas || [])
      if (res.data.exitosos > 0) {
        setSuccess(`${res.data.exitosos} de ${res.data.total} boletas procesadas correctamente`)
      }
      if (res.data.errores > 0) {
        setError(`${res.data.errores} boletas fallaron: ${res.data.detalles?.join(', ')}`)
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al procesar las imágenes')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (results.length === 0) return
    try {
      const ids = results.filter(r => r.id).map(r => r.id).join(',')
      const res = await api.get('/api/ocr/exportar', { params: { ids }, responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `boletas_ocr_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError('Error al exportar')
    }
  }

  const formatCurrency = (v: number) => `S/. ${v.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

  return (
    <div className="min-h-screen">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Scan className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-600">Escanear Boletas</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Escáner OCR de Boletas</h2>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Sube imágenes de boletas de pago para extraer los datos automáticamente
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel izquierdo: carga */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
              <FileImage className="w-4 h-4 text-emerald-600" />
              Cargar Imágenes
            </h3>

            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
                ${dragging ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-emerald-300'}
                ${files.length > 0 ? 'pb-3' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Image className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Arrastra imágenes aquí o haz clic
              </p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, TIFF</p>
            </div>

            {files.length > 0 && (
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded flex items-center justify-center flex-shrink-0">
                      <FileImage className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-emerald-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleScan}
              disabled={loading || files.length === 0}
              className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
              ) : (
                <><Scan className="w-5 h-5" /> Escanear {files.length} imagen{files.length !== 1 ? 'es' : ''}</>
              )}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
            </div>
          )}
        </div>

        {/* Panel derecho: resultados */}
        <div className="lg:col-span-2">
          {results.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  Resultados ({results.length})
                </h3>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all"
                >
                  <Download className="w-4 h-4" /> Exportar Excel
                </button>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-emerald-300 transition-all cursor-pointer"
                    onClick={() => setSelectedResult(r)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                          {r.nombre_completo || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Cód. Modular: {r.codigo_modular || '—'} | {r.institucion || '—'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {MESES[r.mes]} {r.anio} | {r.nivel || '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">{formatCurrency(r.total_liquido)}</p>
                        <p className="text-[10px] text-gray-400">
                          {r.ocr_engine} ({(r.ocr_confidence * 100).toFixed(0)}%)
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-4 text-xs">
                      <span className="text-emerald-600">+{formatCurrency(r.total_haberes)}</span>
                      <span className="text-red-500">-{formatCurrency(r.total_descuentos)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.length === 0 && !loading && (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <FileSpreadsheet className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Sin resultados aún</p>
              <p className="text-sm text-gray-400 mt-1">Sube imágenes de boletas para comenzar</p>
            </div>
          )}

          {loading && (
            <div className="card flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">Procesando imágenes...</p>
              <p className="text-sm text-gray-400 mt-1">Esto puede tomar unos segundos por imagen</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal detalle */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedResult(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedResult.nombre_completo}</h3>
              <button onClick={() => setSelectedResult(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <p className="text-gray-400 text-xs">Código Modular</p>
                <p className="font-semibold">{selectedResult.codigo_modular || '—'}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <p className="text-gray-400 text-xs">Institución</p>
                <p className="font-semibold">{selectedResult.institucion || '—'}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <p className="text-gray-400 text-xs">Período</p>
                <p className="font-semibold">{MESES[selectedResult.mes]} {selectedResult.anio}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <p className="text-gray-400 text-xs">Nivel</p>
                <p className="font-semibold">{selectedResult.nivel || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-emerald-600 mb-2">Haberes</h4>
                <div className="space-y-1">
                  {selectedResult.haberes?.map((h: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-300">{h.codigo} {h.concepto}</span>
                      <span className="font-medium">{formatCurrency(h.monto)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-2">
                    <span>Total</span>
                    <span className="text-emerald-600">{formatCurrency(selectedResult.total_haberes)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-red-500 mb-2">Descuentos</h4>
                <div className="space-y-1">
                  {selectedResult.descuentos?.map((d: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-300">{d.codigo} {d.concepto}</span>
                      <span className="font-medium">{formatCurrency(d.monto)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-2">
                    <span>Total</span>
                    <span className="text-red-500">{formatCurrency(selectedResult.total_descuentos)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex justify-between items-center">
              <span className="font-semibold text-gray-800 dark:text-gray-200">Líquido a Pagar</span>
              <span className="text-xl font-bold text-emerald-600">{formatCurrency(selectedResult.total_liquido)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
