import { useEffect, useState, useRef } from "react";
import {
  personalApi,
  planillasApi,
  ingresosApi,
  descuentosApi,
} from "../services/api";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  User,
  Users,
  Hash,
  Briefcase,
  Building,
  Tag,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Filter,
  MapPin,
  Wallet,
  PlusCircle,
  Save,
} from "lucide-react";

interface Personal {
  id: number;
  dni: string;
  nombres: string;
  apellidos: string;
  puesto: string;
  rd: string;
  uu: string;
  institucion?: string;
  distrito?: string;
}

interface Concepto {
  id: number;
  tipo: string;
  monto: number;
}

interface PlanillaData {
  id: number;
  mes: number;
  anio: number;
  total_haberes: number;
  total_descuentos: number;
  total_liquido: number;
  ingresos: Concepto[];
  descuentos: Concepto[];
}

interface PaginationData {
  data: Personal[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

const MESES = [
  "Todos los meses",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MESES_VALOR = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const ANIOS = Array.from(
  { length: new Date().getFullYear() - 1990 },
  (_, i) => 1991 + i,
).reverse();

export default function Planillas() {
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filtroMes, setFiltroMes] = useState<number>(0);
  const [filtroAnio, setFiltroAnio] = useState<number>(0);
  const [filtroInstitucion, setFiltroInstitucion] = useState("");
  const [filtroDistrito, setFiltroDistrito] = useState("");
  const [filtroRd, setFiltroRd] = useState("");
  const [filtroUu, setFiltroUu] = useState("");
  const [instSuggestions, setInstSuggestions] = useState<string[]>([]);
  const [distSuggestions, setDistSuggestions] = useState<string[]>([]);
  const [showInstSuggestions, setShowInstSuggestions] = useState(false);
  const [showDistSuggestions, setShowDistSuggestions] = useState(false);
  const instRef = useRef<HTMLDivElement>(null);
  const distRef = useRef<HTMLDivElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Personal | null>(null);
  const [form, setForm] = useState({
    dni: "",
    nombres: "",
    apellidos: "",
    puesto: "",
    rd: "",
    uu: "",
    institucion: "",
    distrito: "",
  });
  const [errors, setErrors] = useState<{
    nombres?: string;
    apellidos?: string;
  }>({});

  // Planilla concept editing
  const [planillas, setPlanillas] = useState<PlanillaData[]>([]);
  const [loadingPlanillas, setLoadingPlanillas] = useState(false);
  const [editPlanillaId, setEditPlanillaId] = useState<number | null>(null);
  const [nuevoMes, setNuevoMes] = useState(1);
  const [nuevoAnio, setNuevoAnio] = useState(new Date().getFullYear());
  const [showAgregarPlanilla, setShowAgregarPlanilla] = useState(false);
  const [savingPlanilla, setSavingPlanilla] = useState(false);
  // New planilla conceptos for create modal
  const [nuevosIngresos, setNuevosIngresos] = useState<
    { tipo: string; monto: number }[]
  >([]);
  const [nuevosDescuentos, setNuevosDescuentos] = useState<
    { tipo: string; monto: number }[]
  >([]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadPersonal();
  }, [
    debouncedSearch,
    page,
    filtroMes,
    filtroAnio,
    filtroInstitucion,
    filtroDistrito,
    filtroRd,
    filtroUu,
  ]);

  useEffect(() => {
    if (!filtroInstitucion || filtroInstitucion.length < 2) {
      setInstSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      personalApi
        .instituciones(filtroInstitucion)
        .then((r) => setInstSuggestions(r.data.data || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [filtroInstitucion]);

  useEffect(() => {
    if (!filtroDistrito || filtroDistrito.length < 2) {
      setDistSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      personalApi
        .distritos(filtroDistrito)
        .then((r) => setDistSuggestions(r.data.data || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [filtroDistrito]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (instRef.current && !instRef.current.contains(e.target as Node))
        setShowInstSuggestions(false);
      if (distRef.current && !distRef.current.contains(e.target as Node))
        setShowDistSuggestions(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const loadPersonal = () => {
    setLoading(true);
    const mes = filtroMes > 0 ? filtroMes : undefined;
    const anio = filtroAnio > 0 ? filtroAnio : undefined;
    personalApi
      .list(
        debouncedSearch,
        page,
        20,
        "apellidos",
        "asc",
        mes,
        anio,
        filtroInstitucion || undefined,
        filtroDistrito || undefined,
        filtroRd || undefined,
        filtroUu || undefined,
      )
      .then((res: { data: PaginationData }) => {
        setPersonal(res.data.data);
        setTotal(res.data.total);
        setTotalPages(res.data.total_pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const cargarPlanillas = async (personalId: number) => {
    setLoadingPlanillas(true);
    try {
      const res: any = await personalApi.exportar(personalId);
      setPlanillas(res.data.planillas || []);
    } catch {
      setPlanillas([]);
    }
    setLoadingPlanillas(false);
  };

  const guardarConceptos = async (planillaId: number) => {
    setSavingPlanilla(true);
    const p = planillas.find((x) => x.id === planillaId);
    if (!p || !editing) {
      setSavingPlanilla(false);
      return;
    }
    try {
      await planillasApi.editarCompleta(planillaId, {
        ingresos: p.ingresos.map((i) => ({
          id: i.id || 0,
          tipo: i.tipo,
          monto: i.monto,
        })),
        descuentos: p.descuentos.map((d) => ({
          id: d.id || 0,
          tipo: d.tipo,
          monto: d.monto,
        })),
      });
      setEditPlanillaId(null);
      await cargarPlanillas(editing.id);
    } catch (e) {
      console.error(e);
    }
    setSavingPlanilla(false);
  };

  const agregarConceptoHaberes = (planillaId: number) => {
    setPlanillas((prev) =>
      prev.map((p) =>
        p.id === planillaId
          ? { ...p, ingresos: [...p.ingresos, { id: 0, tipo: "", monto: 0 }] }
          : p,
      ),
    );
  };

  const agregarConceptoDescuentos = (planillaId: number) => {
    setPlanillas((prev) =>
      prev.map((p) =>
        p.id === planillaId
          ? {
              ...p,
              descuentos: [...p.descuentos, { id: 0, tipo: "", monto: 0 }],
            }
          : p,
      ),
    );
  };

  const actualizarConcepto = (
    planillaId: number,
    tipo: "ingresos" | "descuentos",
    idx: number,
    field: "tipo" | "monto",
    value: string | number,
  ) => {
    setPlanillas((prev) =>
      prev.map((p) =>
        p.id === planillaId
          ? {
              ...p,
              [tipo]: p[tipo].map((c, i) =>
                i === idx
                  ? { ...c, [field]: field === "monto" ? Number(value) : value }
                  : c,
              ),
            }
          : p,
      ),
    );
  };

  const eliminarConcepto = async (
    planillaId: number,
    tipo: "ingresos" | "descuentos",
    idx: number,
  ) => {
    const c = planillas.find((p) => p.id === planillaId)?.[tipo][idx];
    if (c?.id && c.id > 0) {
      try {
        if (tipo === "ingresos") await ingresosApi.delete(c.id);
        else await descuentosApi.delete(c.id);
      } catch {}
    }
    setPlanillas((prev) =>
      prev.map((p) =>
        p.id === planillaId
          ? { ...p, [tipo]: p[tipo].filter((_, i) => i !== idx) }
          : p,
      ),
    );
  };

  const handleAgregarPlanilla = async () => {
    if (!editing) return;
    setSavingPlanilla(true);
    try {
      await planillasApi.create({
        personal_id: editing.id,
        mes: nuevoMes,
        anio: nuevoAnio,
      });
      await cargarPlanillas(editing.id);
      setShowAgregarPlanilla(false);
    } catch (e) {
      console.error(e);
    }
    setSavingPlanilla(false);
  };

  const validateForm = () => {
    const newErrors: { nombres?: string; apellidos?: string } = {};
    if (!form.nombres.trim()) newErrors.nombres = "El nombre es requerido";
    if (!form.apellidos.trim())
      newErrors.apellidos = "Los apellidos son requeridos";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (editing) {
        await personalApi.update(editing.id, form);
      } else {
        const res: any = await personalApi.create(form);
        const newId = res.data?.id;
        // Create first planilla with conceptos if provided
        if (
          newId &&
          (nuevosIngresos.length > 0 || nuevosDescuentos.length > 0)
        ) {
          const planillaRes: any = await planillasApi.create({
            personal_id: newId,
            mes: nuevoMes,
            anio: nuevoAnio,
          });
          const planillaId = planillaRes.data?.id;
          if (planillaId) {
            const ingresosData = nuevosIngresos
              .filter((i) => i.tipo.trim() && i.monto > 0)
              .map((i) => ({ id: 0, tipo: i.tipo, monto: i.monto }));
            const descuentosData = nuevosDescuentos
              .filter((d) => d.tipo.trim() && d.monto > 0)
              .map((d) => ({ id: 0, tipo: d.tipo, monto: d.monto }));
            if (ingresosData.length > 0 || descuentosData.length > 0) {
              await planillasApi.editarCompleta(planillaId, {
                ingresos: ingresosData,
                descuentos: descuentosData,
              });
            }
          }
        }
      }
      setShowModal(false);
      setEditing(null);
      setForm({
        dni: "",
        nombres: "",
        apellidos: "",
        puesto: "",
        rd: "",
        uu: "",
        institucion: "",
        distrito: "",
      });
      setNuevosIngresos([]);
      setNuevosDescuentos([]);
      setErrors({});
      loadPersonal();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = (p: Personal) => {
    setEditing(p);
    setForm({
      dni: p.dni || "",
      nombres: p.nombres,
      apellidos: p.apellidos,
      puesto: p.puesto || "",
      rd: p.rd || "",
      uu: p.uu || "",
      institucion: p.institucion || "",
      distrito: p.distrito || "",
    });
    setPlanillas([]);
    setEditPlanillaId(null);
    setShowAgregarPlanilla(false);
    setShowModal(true);
    cargarPlanillas(p.id);
  };

  const confirmDelete = (p: Personal) => {
    setDeletingId(p.id);
    setDeletingName(`${p.apellidos} ${p.nombres}`);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (deletingId === null) return;
    setDeleting(true);
    try {
      await personalApi.delete(deletingId);
      setShowDeleteModal(false);
      setDeletingId(null);
      setDeletingName("");
      loadPersonal();
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const openCreateModal = () => {
    setEditing(null);
    setForm({
      dni: "",
      nombres: "",
      apellidos: "",
      puesto: "",
      rd: "",
      uu: "",
      institucion: "",
      distrito: "",
    });
    setErrors({});
    setShowModal(true);
  };

  const getPaginationRange = () => {
    const range: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-semibold text-emerald-600">
              Planilla de Personal Docente
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Planillas
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Administra el personal docente de tu organización
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Personal Docente</span>
        </button>
      </div>

      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl shadow-lg overflow-hidden">
        <div className="p-5 pb-4 space-y-4">
          {/* ── Row 1: Counter + Mes/Año + Search ── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-2.5 bg-white/15 rounded-xl">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{total}</p>
                <p className="text-xs text-emerald-100/80 mt-0.5">
                  Personal Docente
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:pl-4 sm:border-l border-white/20">
              <Filter className="w-4 h-4 text-emerald-200 shrink-0 hidden sm:block" />
              <select
                className="bg-white/15 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 appearance-none cursor-pointer min-w-[140px]"
                value={filtroMes}
                onChange={(e) => {
                  const newMes = Number(e.target.value);
                  setFiltroMes(newMes);
                  if (newMes > 0 && filtroAnio === 0) {
                    setFiltroAnio(ANIOS[0] || new Date().getFullYear());
                  }
                  setPage(1);
                }}
              >
                {MESES.map((m, i) => (
                  <option key={i} value={i} className="text-gray-900">
                    {m}
                  </option>
                ))}
              </select>
              {filtroMes > 0 && (
                <select
                  className="bg-white/15 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 appearance-none cursor-pointer min-w-[100px]"
                  value={filtroAnio}
                  onChange={(e) => {
                    setFiltroAnio(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {ANIOS.map((a) => (
                    <option key={a} value={a} className="text-gray-900">
                      {a}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="relative flex-1 min-w-0 flex items-center gap-2 bg-white/15 border border-white/20 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-emerald-200 shrink-0" />
              <input
                type="text"
                placeholder="Buscar por DNI, nombre o apellido..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-emerald-200/70 text-sm min-w-0 focus:ring-0 p-0"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button onClick={() => setSearchInput("")} className="text-emerald-200 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── Row 2: Filtros avanzados ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="relative" ref={instRef}>
              <label className="block text-[10px] uppercase tracking-wider text-emerald-200/70 mb-1 font-medium">
                Institución
              </label>
              <div className="flex items-center gap-2 bg-white/15 border border-white/20 rounded-lg px-3 py-2">
                <Building className="w-3.5 h-3.5 text-emerald-200/60 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar institución..."
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-emerald-200/50 text-xs min-w-0 focus:ring-0 p-0"
                  value={filtroInstitucion}
                  onChange={(e) => {
                    setFiltroInstitucion(e.target.value);
                    setShowInstSuggestions(true);
                    setPage(1);
                  }}
                  onFocus={() => setShowInstSuggestions(true)}
                />
                {filtroInstitucion && (
                  <button
                    onClick={() => {
                      setFiltroInstitucion("");
                      setInstSuggestions([]);
                      setPage(1);
                    }}
                    className="text-emerald-200 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {showInstSuggestions && instSuggestions.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                  {instSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0 truncate"
                      onClick={() => {
                        setFiltroInstitucion(s);
                        setShowInstSuggestions(false);
                        setPage(1);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={distRef}>
              <label className="block text-[10px] uppercase tracking-wider text-emerald-200/70 mb-1 font-medium">
                Distrito
              </label>
              <div className="flex items-center gap-2 bg-white/15 border border-white/20 rounded-lg px-3 py-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-200/60 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar distrito..."
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-emerald-200/50 text-xs min-w-0 focus:ring-0 p-0"
                  value={filtroDistrito}
                  onChange={(e) => {
                    setFiltroDistrito(e.target.value);
                    setShowDistSuggestions(true);
                    setPage(1);
                  }}
                  onFocus={() => setShowDistSuggestions(true)}
                />
                {filtroDistrito && (
                  <button
                    onClick={() => {
                      setFiltroDistrito("");
                      setDistSuggestions([]);
                      setPage(1);
                    }}
                    className="text-emerald-200 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {showDistSuggestions && distSuggestions.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                  {distSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0 truncate"
                      onClick={() => {
                        setFiltroDistrito(s);
                        setShowDistSuggestions(false);
                        setPage(1);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-emerald-200/70 mb-1 font-medium">
                RD
              </label>
              <div className="flex items-center gap-2 bg-white/15 border border-white/20 rounded-lg px-3 py-2">
                <Hash className="w-3.5 h-3.5 text-emerald-200/60 shrink-0" />
                <input
                  type="text"
                  placeholder="Ej: RD 001234"
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-emerald-200/50 text-xs min-w-0 focus:ring-0 p-0"
                  value={filtroRd}
                  onChange={(e) => {
                    setFiltroRd(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-emerald-200/70 mb-1 font-medium">
                UU
              </label>
              <div className="flex items-center gap-2 bg-white/15 border border-white/20 rounded-lg px-3 py-2">
                <Tag className="w-3.5 h-3.5 text-emerald-200/60 shrink-0" />
                <input
                  type="text"
                  placeholder="Ej: UU-9999"
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-emerald-200/50 text-xs min-w-0 focus:ring-0 p-0"
                  value={filtroUu}
                  onChange={(e) => {
                    setFiltroUu(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Active filter chips ── */}
        {(filtroMes > 0 ||
          filtroInstitucion ||
          filtroDistrito ||
          filtroRd ||
          filtroUu) && (
          <div className="px-5 py-2.5 bg-black/10 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-emerald-100/60 mr-0.5">Filtros:</span>
            {filtroMes > 0 && (
              <span className="inline-flex items-center gap-1 bg-white/15 text-emerald-100 px-2.5 py-1 rounded-full font-medium">
                {MESES_VALOR[filtroMes]} {filtroAnio || ""}
                <button
                  onClick={() => {
                    setFiltroMes(0);
                    setFiltroAnio(0);
                    setPage(1);
                  }}
                  className="text-emerald-200 hover:text-white ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filtroInstitucion && (
              <span className="inline-flex items-center gap-1 bg-white/15 text-emerald-100 px-2.5 py-1 rounded-full font-medium truncate max-w-[200px]">
                <Building className="w-3 h-3 shrink-0" />
                {filtroInstitucion}
                <button
                  onClick={() => {
                    setFiltroInstitucion("");
                    setInstSuggestions([]);
                    setPage(1);
                  }}
                  className="text-emerald-200 hover:text-white ml-0.5 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filtroDistrito && (
              <span className="inline-flex items-center gap-1 bg-white/15 text-emerald-100 px-2.5 py-1 rounded-full font-medium truncate max-w-[200px]">
                <MapPin className="w-3 h-3 shrink-0" />
                {filtroDistrito}
                <button
                  onClick={() => {
                    setFiltroDistrito("");
                    setDistSuggestions([]);
                    setPage(1);
                  }}
                  className="text-emerald-200 hover:text-white ml-0.5 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filtroRd && (
              <span className="inline-flex items-center gap-1 bg-white/15 text-emerald-100 px-2.5 py-1 rounded-full font-medium">
                RD: {filtroRd}
                <button
                  onClick={() => {
                    setFiltroRd("");
                    setPage(1);
                  }}
                  className="text-emerald-200 hover:text-white ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filtroUu && (
              <span className="inline-flex items-center gap-1 bg-white/15 text-emerald-100 px-2.5 py-1 rounded-full font-medium">
                UU: {filtroUu}
                <button
                  onClick={() => {
                    setFiltroUu("");
                    setPage(1);
                  }}
                  className="text-emerald-200 hover:text-white ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setFiltroMes(0);
                setFiltroAnio(0);
                setFiltroInstitucion("");
                setInstSuggestions([]);
                setFiltroDistrito("");
                setDistSuggestions([]);
                setFiltroRd("");
                setFiltroUu("");
                setPage(1);
              }}
              className="text-emerald-200 hover:text-white underline ml-1"
            >
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
              >
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-xl animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 w-48 bg-gray-200 dark:bg-gray-600 rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-32 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : personal.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {searchInput || filtroMes > 0 || filtroAnio > 0
                ? "Sin resultados"
                : "No hay personal docente registrado"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchInput || filtroMes > 0 || filtroAnio > 0
                ? `No se encontraron resultados para los filtros aplicados`
                : "Importa un archivo Excel o agrega manualmente para comenzar"}
            </p>
            {!searchInput && filtroMes === 0 && filtroAnio === 0 && (
              <button
                onClick={openCreateModal}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Personal Docente</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left py-4 px-5">Docente</th>
                  <th className="text-left py-4 px-4">DNI</th>
                  <th className="text-left py-4 px-4">Cargo</th>
                  <th className="text-left py-4 px-4">RD</th>
                  <th className="text-left py-4 px-4">UU</th>
                  <th className="text-right py-4 px-5">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {personal.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          {p.nombres?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {p.apellidos} {p.nombres}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {p.puesto || "Sin cargo"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg text-gray-700 dark:text-gray-300">
                        {p.dni || "-"}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {p.puesto || "-"}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono text-sm text-gray-500 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded dark:text-gray-400">
                        {p.rd || "-"}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono text-sm text-gray-500 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded dark:text-gray-400">
                        {p.uu || "-"}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-all"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => confirmDelete(p)}
                          className="p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500 transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Mostrando{" "}
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {(page - 1) * 20 + 1}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {Math.min(page * 20, total)}
                  </span>{" "}
                  de{" "}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {total}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <ChevronLeft className="w-3 h-3 -ml-2" />
                  </button>
                  {getPaginationRange().map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                        page === pageNum
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-t-2xl shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    {editing ? (
                      <Pencil className="w-5 h-5 text-white" />
                    ) : (
                      <User className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {editing
                        ? "Editar Personal Docente"
                        : "Nuevo Personal Docente"}
                    </h3>
                    <p className="text-white/70 text-sm">
                      {editing
                        ? "Actualiza los datos del docente"
                        : "Registra un nuevo docente"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── Columna izquierda: Datos personales ── */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
                    <User className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                      Datos Personales
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                        <Hash className="w-3.5 h-3.5 inline mr-1" /> DNI
                      </label>
                      <input
                        type="text"
                        value={form.dni}
                        onChange={(e) =>
                          setForm({ ...form, dni: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                        placeholder="12345678"
                        maxLength={8}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                        <Briefcase className="w-3.5 h-3.5 inline mr-1" /> Cargo
                      </label>
                      <input
                        type="text"
                        value={form.puesto}
                        onChange={(e) =>
                          setForm({ ...form, puesto: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                        placeholder="Docente, Auxiliar, etc."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                      <User className="w-3.5 h-3.5 inline mr-1" /> Nombres *
                    </label>
                    <input
                      type="text"
                      value={form.nombres}
                      onChange={(e) => {
                        setForm({ ...form, nombres: e.target.value });
                        if (errors.nombres)
                          setErrors({ ...errors, nombres: undefined });
                      }}
                      className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border-2 ${errors.nombres ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-gray-200 dark:border-gray-600"} rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400`}
                      placeholder="Nombres completos"
                    />
                    {errors.nombres && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                        {errors.nombres}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                      <User className="w-3.5 h-3.5 inline mr-1" /> Apellidos *
                    </label>
                    <input
                      type="text"
                      value={form.apellidos}
                      onChange={(e) => {
                        setForm({ ...form, apellidos: e.target.value });
                        if (errors.apellidos)
                          setErrors({ ...errors, apellidos: undefined });
                      }}
                      className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border-2 ${errors.apellidos ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-gray-200 dark:border-gray-600"} rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400`}
                      placeholder="Apellidos completos"
                    />
                    {errors.apellidos && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                        {errors.apellidos}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                        <Tag className="w-3.5 h-3.5 inline mr-1" /> RD
                      </label>
                      <input
                        type="text"
                        value={form.rd}
                        onChange={(e) =>
                          setForm({ ...form, rd: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                        placeholder="RD"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                        <Building className="w-3.5 h-3.5 inline mr-1" /> UU
                      </label>
                      <input
                        type="text"
                        value={form.uu}
                        onChange={(e) =>
                          setForm({ ...form, uu: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                        placeholder="UU"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                        <Building className="w-3.5 h-3.5 inline mr-1" />{" "}
                        Institución
                      </label>
                      <input
                        type="text"
                        value={form.institucion}
                        onChange={(e) =>
                          setForm({ ...form, institucion: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                        placeholder="Nombre de la institución"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                        <MapPin className="w-3.5 h-3.5 inline mr-1" /> Distrito
                      </label>
                      <input
                        type="text"
                        value={form.distrito}
                        onChange={(e) =>
                          setForm({ ...form, distrito: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                        placeholder="Distrito"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Columna derecha: Planillas y Conceptos ── */}
                <div className="space-y-4">
                  {editing ? (
                    <>
                      <div className="flex items-center justify-between pb-1 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                            Planillas y Conceptos
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setShowAgregarPlanilla(!showAgregarPlanilla)
                          }
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Agregar
                        </button>
                      </div>

                      {showAgregarPlanilla && (
                        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-3">
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Mes
                              </label>
                              <select
                                value={nuevoMes}
                                onChange={(e) =>
                                  setNuevoMes(Number(e.target.value))
                                }
                                className="w-full px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:border-green-500 text-gray-900 dark:text-white appearance-none cursor-pointer"
                              >
                                {MESES_VALOR.filter((_, i) => i > 0).map(
                                  (m, i) => (
                                    <option key={i + 1} value={i + 1}>
                                      {m}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div className="w-24">
                              <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Año
                              </label>
                              <input
                                type="number"
                                value={nuevoAnio}
                                onChange={(e) =>
                                  setNuevoAnio(Number(e.target.value))
                                }
                                className="w-full px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:border-green-500 text-gray-900 dark:text-white"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAgregarPlanilla}
                              disabled={savingPlanilla}
                              className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors shrink-0"
                            >
                              {savingPlanilla ? "..." : "Crear"}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {loadingPlanillas ? (
                          <div className="text-center py-8">
                            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-xs text-gray-400">
                              Cargando planillas...
                            </p>
                          </div>
                        ) : planillas.length === 0 ? (
                          <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                            <Wallet className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-xs text-gray-400">
                              Sin planillas registradas
                            </p>
                            <p className="text-[10px] text-gray-300 mt-1">
                              Usa "Agregar" para crear una nueva
                            </p>
                          </div>
                        ) : (
                          planillas.map((p) => (
                            <div
                              key={p.id}
                              className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setEditPlanillaId(
                                    editPlanillaId === p.id ? null : p.id,
                                  )
                                }
                                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                              >
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                  {MESES_VALOR[p.mes]} {p.anio}
                                </span>
                                <div className="flex items-center gap-3 text-[11px] font-medium">
                                  <span className="text-green-600 dark:text-green-400">
                                    H: S/{p.total_haberes.toFixed(2)}
                                  </span>
                                  <span className="text-emerald-500">
                                    D: S/{p.total_descuentos.toFixed(2)}
                                  </span>
                                  <span
                                    className={`${p.total_haberes - p.total_descuentos >= 0 ? "text-blue-600" : "text-emerald-600"}`}
                                  >
                                    N: S/
                                    {(
                                      p.total_haberes - p.total_descuentos
                                    ).toFixed(2)}
                                  </span>
                                </div>
                              </button>

                              {editPlanillaId === p.id && (
                                <div className="p-4 space-y-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full">
                                        Ingresos
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          agregarConceptoHaberes(p.id)
                                        }
                                        className="text-[11px] text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-0.5 px-2 py-0.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                      >
                                        <PlusCircle className="w-3 h-3" />{" "}
                                        Agregar
                                      </button>
                                    </div>
                                    {p.ingresos.length === 0 ? (
                                      <p className="text-[11px] text-gray-400 italic text-center py-2">
                                        Sin ingresos registrados
                                      </p>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {p.ingresos.map((c, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-center gap-2"
                                          >
                                            <input
                                              value={c.tipo}
                                              onChange={(e) =>
                                                actualizarConcepto(
                                                  p.id,
                                                  "ingresos",
                                                  idx,
                                                  "tipo",
                                                  e.target.value,
                                                )
                                              }
                                              className="flex-1 min-w-0 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 text-gray-900 dark:text-white placeholder:text-gray-400"
                                              placeholder="Concepto"
                                            />
                                            <div className="relative w-28">
                                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">
                                                S/
                                              </span>
                                              <input
                                                type="number"
                                                step="0.01"
                                                value={c.monto}
                                                onChange={(e) =>
                                                  actualizarConcepto(
                                                    p.id,
                                                    "ingresos",
                                                    idx,
                                                    "monto",
                                                    e.target.value,
                                                  )
                                                }
                                                className="w-full pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 text-gray-900 dark:text-white text-right"
                                                placeholder="0.00"
                                              />
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                eliminarConcepto(
                                                  p.id,
                                                  "ingresos",
                                                  idx,
                                                )
                                              }
                                              className="p-1.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">
                                        Descuentos
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          agregarConceptoDescuentos(p.id)
                                        }
                                        className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-0.5 px-2 py-0.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                      >
                                        <PlusCircle className="w-3 h-3" />{" "}
                                        Agregar
                                      </button>
                                    </div>
                                    {p.descuentos.length === 0 ? (
                                      <p className="text-[11px] text-gray-400 italic text-center py-2">
                                        Sin descuentos registrados
                                      </p>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {p.descuentos.map((c, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-center gap-2"
                                          >
                                            <input
                                              value={c.tipo}
                                              onChange={(e) =>
                                                actualizarConcepto(
                                                  p.id,
                                                  "descuentos",
                                                  idx,
                                                  "tipo",
                                                  e.target.value,
                                                )
                                              }
                                              className="flex-1 min-w-0 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-gray-900 dark:text-white placeholder:text-gray-400"
                                              placeholder="Concepto"
                                            />
                                            <div className="relative w-28">
                                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">
                                                S/
                                              </span>
                                              <input
                                                type="number"
                                                step="0.01"
                                                value={c.monto}
                                                onChange={(e) =>
                                                  actualizarConcepto(
                                                    p.id,
                                                    "descuentos",
                                                    idx,
                                                    "monto",
                                                    e.target.value,
                                                  )
                                                }
                                                className="w-full pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-gray-900 dark:text-white text-right"
                                                placeholder="0.00"
                                              />
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                eliminarConcepto(
                                                  p.id,
                                                  "descuentos",
                                                  idx,
                                                )
                                              }
                                              className="p-1.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => guardarConceptos(p.id)}
                                    disabled={savingPlanilla}
                                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5 shadow-sm"
                                  >
                                    <Save className="w-3.5 h-3.5" />{" "}
                                    {savingPlanilla
                                      ? "Guardando..."
                                      : "Guardar conceptos"}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
                        <Wallet className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                          Agregar primera planilla
                        </h4>
                        <span className="text-[10px] text-gray-400 font-normal">
                          (opcional)
                        </span>
                      </div>

                      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <label className="block text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                              Mes
                            </label>
                            <select
                              value={nuevoMes}
                              onChange={(e) =>
                                setNuevoMes(Number(e.target.value))
                              }
                              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-amber-500 text-gray-900 dark:text-white appearance-none cursor-pointer"
                            >
                              {MESES_VALOR.filter((_, i) => i > 0).map(
                                (m, i) => (
                                  <option key={i + 1} value={i + 1}>
                                    {m}
                                  </option>
                                ),
                              )}
                            </select>
                          </div>
                          <div className="w-28">
                            <label className="block text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                              Año
                            </label>
                            <input
                              type="number"
                              value={nuevoAnio}
                              onChange={(e) =>
                                setNuevoAnio(Number(e.target.value))
                              }
                              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-amber-500 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                                Ingresos
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setNuevosIngresos((prev) => [
                                    ...prev,
                                    { tipo: "", monto: 0 },
                                  ])
                                }
                                className="text-[11px] text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-0.5"
                              >
                                <PlusCircle className="w-3 h-3" /> Agregar
                              </button>
                            </div>
                            {nuevosIngresos.length === 0 ? (
                              <p className="text-[11px] text-gray-400 italic text-center py-3 bg-white dark:bg-gray-700/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-600">
                                Sin ingresos — presiona "Agregar"
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {nuevosIngresos.map((c, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1.5"
                                  >
                                    <input
                                      value={c.tipo}
                                      onChange={(e) =>
                                        setNuevosIngresos((prev) =>
                                          prev.map((x, i) =>
                                            i === idx
                                              ? { ...x, tipo: e.target.value }
                                              : x,
                                          ),
                                        )
                                      }
                                      className="flex-1 min-w-0 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 text-gray-900 dark:text-white"
                                      placeholder="Concepto"
                                    />
                                    <div className="relative w-24">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">
                                        S/
                                      </span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={c.monto}
                                        onChange={(e) =>
                                          setNuevosIngresos((prev) =>
                                            prev.map((x, i) =>
                                              i === idx
                                                ? {
                                                    ...x,
                                                    monto: Number(
                                                      e.target.value,
                                                    ),
                                                  }
                                                : x,
                                            ),
                                          )
                                        }
                                        className="w-full pl-6 pr-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 text-gray-900 dark:text-white text-right"
                                        placeholder="0.00"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setNuevosIngresos((prev) =>
                                          prev.filter((_, i) => i !== idx),
                                        )
                                      }
                                      className="p-1 text-emerald-400 hover:text-emerald-600"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                Descuentos
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setNuevosDescuentos((prev) => [
                                    ...prev,
                                    { tipo: "", monto: 0 },
                                  ])
                                }
                                className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-0.5"
                              >
                                <PlusCircle className="w-3 h-3" /> Agregar
                              </button>
                            </div>
                            {nuevosDescuentos.length === 0 ? (
                              <p className="text-[11px] text-gray-400 italic text-center py-3 bg-white dark:bg-gray-700/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-600">
                                Sin descuentos — presiona "Agregar"
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {nuevosDescuentos.map((c, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1.5"
                                  >
                                    <input
                                      value={c.tipo}
                                      onChange={(e) =>
                                        setNuevosDescuentos((prev) =>
                                          prev.map((x, i) =>
                                            i === idx
                                              ? { ...x, tipo: e.target.value }
                                              : x,
                                          ),
                                        )
                                      }
                                      className="flex-1 min-w-0 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-gray-900 dark:text-white"
                                      placeholder="Concepto"
                                    />
                                    <div className="relative w-24">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">
                                        S/
                                      </span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={c.monto}
                                        onChange={(e) =>
                                          setNuevosDescuentos((prev) =>
                                            prev.map((x, i) =>
                                              i === idx
                                                ? {
                                                    ...x,
                                                    monto: Number(
                                                      e.target.value,
                                                    ),
                                                  }
                                                : x,
                                            ),
                                          )
                                        }
                                        className="w-full pl-6 pr-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-gray-900 dark:text-white text-right"
                                        placeholder="0.00"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setNuevosDescuentos((prev) =>
                                          prev.filter((_, i) => i !== idx),
                                        )
                                      }
                                      className="p-1 text-emerald-400 hover:text-emerald-600"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all shadow-sm text-sm inline-flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />{" "}
                  {editing ? "Actualizar Personal" : "Guardar Personal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-emerald-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Eliminar Personal Docente
                    </h3>
                    <p className="text-white/70 text-sm">
                      Esta acción no se puede deshacer
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl mb-5">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-800 rounded-xl flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {deletingName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Será eliminado permanentemente
                  </p>
                </div>
              </div>

              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                ¿Estás seguro de eliminar a{" "}
                <strong className="text-gray-900 dark:text-white">
                  {deletingName}
                </strong>
                ? Esta acción eliminará todos sus datos y no se podrá recuperar.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-all inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {deleting ? (
                    <>Eliminando...</>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Sí, eliminar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
