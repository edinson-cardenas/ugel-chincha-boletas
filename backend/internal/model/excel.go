package model

type DataExcel struct {
	Personal  []Personal       `json:"personal"`
	Planillas []PlanillaImport `json:"planillas"`
}

type PlanillaImport struct {
	DNI        string            `json:"dni"`
	Nombres    string            `json:"nombres"`
	Mes        int               `json:"mes"`
	Anio       int               `json:"anio"`
	Ingresos   []IngresoImport   `json:"ingresos"`
	Descuentos []DescuentoImport `json:"descuentos"`
}

type IngresoImport struct {
	Tipo  string  `json:"tipo"`
	Monto float64 `json:"monto"`
}

type DescuentoImport struct {
	Tipo  string  `json:"tipo"`
	Monto float64 `json:"monto"`
}

type HaberesPayload struct {
	Mes            *int            `json:"mes"`
	Anio           *int            `json:"anio"`
	TotalEmpleados int             `json:"total_empleados"`
	Empleados      []EmpleadoHaber `json:"empleados"`
}

type EmpleadoHaber struct {
	Nombre         string  `json:"nombre"`
	DNI            string  `json:"dni"`
	Institucion    string  `json:"institucion"`
	Distrito       string  `json:"distrito"`
	Cargo          string  `json:"cargo"`
	Resolucion     string  `json:"resolucion"`
	Codigo         string  `json:"codigo"`
	TotalHaberes   float64 `json:"total_haberes"`
	TotalDescuento float64 `json:"total_descuento"`
	TotalLiquido   float64 `json:"total_liquido"`
	Haberes        []ConceptoImport  `json:"haberes"`
	Descuentos     []ConceptoImport  `json:"descuentos"`
}

type ConceptoImport struct {
	Concepto string  `json:"concepto"`
	Monto    float64 `json:"monto"`
}
