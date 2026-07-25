import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface Option {
  value: string | number
  label: string
}

interface ComboBoxProps {
  options: Option[]
  value: string | number
  onChange: (value: string | number) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function ComboBox({ options, value, onChange, placeholder = 'Seleccionar...', className = '', disabled = false }: ComboBoxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find(o => o.value === value)?.label ?? ''

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        className={`input flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => { if (!disabled) { setOpen(!open); setSearch('') } }}
      >
        <span className="flex-1 truncate text-sm">{selectedLabel || <span className="text-gray-400">{placeholder}</span>}</span>
        {value !== '' && value !== undefined && (
          <button
            onClick={e => { e.stopPropagation(); onChange(''); setSearch('') }}
            className="text-gray-400 hover:text-gray-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              type="text"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-emerald-500 dark:text-white placeholder:text-gray-400"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">Sin resultados</div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt.value}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    opt.value === value ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
