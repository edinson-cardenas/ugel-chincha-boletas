package ocr

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"planillas-backend/internal/model"
)

var (
	// Datos del empleado
	reNombre      = regexp.MustCompile(`(?i)APELLIDOS\s*(?:Y|/)?\s*NOMBRES?\s*:?\s*(.+)`)
	reCodModular  = regexp.MustCompile(`(?i)CODIGO\s*MODULAR\s*:?\s*(\d{6,10})`)
	reCentroTrab  = regexp.MustCompile(`(?i)CENTRO\s*DE\s*TRABAJO\s*:?\s*(.+)`)
	reNivel       = regexp.MustCompile(`(?i)NIVEL\s*:?\s*(INICIAL|PRIMARIA|SECUNDARIA|SUPERIOR|ESPECIAL|ALTERNATIVA|TECNICO\s*PRODUCTIV)`)
	reEstablec    = regexp.MustCompile(`(?i)ESTABLECIMIENTO\s*:?\s*(\w+)`)

	// Período
	rePeriodo     = regexp.MustCompile(`(\d{4})\s+MES\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SETIEMBRE|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)`)

	// Totales
	reTHaberes    = regexp.MustCompile(`(?i)T\.?\s*HABERES?\s*:?\s*S/\s*\.?\s*([\d,]+\.?\d*)`)
	reTDescuento  = regexp.MustCompile(`(?i)T\.?\s*DESCUENTO\s*:?\s*S/\s*\.?\s*([\d,]+\.?\d*)`)
	reLiquido     = regexp.MustCompile(`(?i)LIQUIDO\s*:?\s*S/\s*\.?\s*([\d,]+\.?\d*)`)
	reImponible   = regexp.MustCompile(`(?i)MONTO\s*IMPONIBLE\s*:?\s*S/\s*\.?\s*([\d,]+\.?\d*)`)

	// Haberes y descuentos
	reConcepto    = regexp.MustCompile(`^([+-]\d{1,3})\s+(.+?)\s+([\d,]+\.?\d*)\s*$`)
	reConcepto2   = regexp.MustCompile(`([+-]\d{1,3})\s+([A-ZÁÉÍÓÚÑ0-9\+\.\-]+(?:\s+[A-ZÁÉÍÓÚÑ0-9\+\.\-]+)*?)\s+([\d,]+\.?\d{2})`)

	// ---- FALLBACK patterns para OCR de baja calidad ----
	// Nombres: apellido(s) + nombre(s) - patrón flexible
	reNombrePersona = regexp.MustCompile(`(?i)((?:DE\s+LA\s+)?(?:CRUZ|TORRES|GARC[IÍ]A|L[OÓ]PEZ|MART[IÍ]NEZ|RODR[IÍ]GUEZ|FERN[ÁA]NDEZ|P[ÉE]REZ|GONZ[ÁA]LEZ|S[ÁA]NCHEZ|RAM[IÍ]REZ|D[IÍ]AZ|CASTILLO|ALMEYDA|NONONE|RENGIFO|CH[ÁA]VEZ|V[ÁA]SQUEZ|ABURTO|ALC[ÁA]NTARA|MENDOZA|FLORES|R[ÍI]OS|RIVERA|VARGAS|CAMPOS|MEDINA|VEGA|HERRERA|AGUILAR|DELGADO|MORALES|ORTIZ|RUIZ|JIM[ÉE]NEZ|GUZM[ÁA]N|SALAZAR|ROMERO|VALENCIA|LE[ÓO]N|CASTRO|REYES|GUERRERO|[A-ZÁÉÍÓÚÑ]{3,})\s+([A-ZÁÉÍÓÚÑ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ]{3,}){0,2}))`)
	// Nombres compuestos femeninos/masculinos comunes
	reNombreMujer  = regexp.MustCompile(`(?i)(TEOFILA\s+HAYDEE|GUILERMINA\s+SABINA|MAR[IÍ]A\s+(?:ELENA|LUISA|ISABEL|TERESA|DEL\s+CARMEN)|ROSA\s+(?:MAR[IÍ]A|ELENA)|ANA\s+(?:MAR[IÍ]A|LUISA)|CARMEN\s+(?:ROSA)|JUANA\s+(?:MAR[IÍ]A)|GLORIA\s+(?:ISABEL)|SONIA\s+(?:BEATRIZ)|MIRIAM\s+[A-Z]+|CARLOS\s+[A-Z]+|JOS[ÉE]\s+[A-Z]+|JUAN\s+[A-Z]+|LUIS\s+[A-Z]+|PEDRO\s+[A-Z]+|MIGUEL\s+[A-Z]+|JORGE\s+[A-Z]+)`)
	// DNI: 8 dígitos (excluyendo años)
	reDniFallback = regexp.MustCompile(`\b(?!19\d{2}\b|20\d{2}\b)(\d{8})\b`)
	// Totales con formato claro S/ XXX.XX
	reTotalFallback  = regexp.MustCompile(`(?i)S/\s*\.?\s*([\d,]+\.[\d]{2})`)
	reLiquidoFallback = regexp.MustCompile(`(?i)(?:L[IÍ]QUIDO|LIQUIDO|NETO|TOTAL)\s*:?\s*S?/?\s*\.?\s*([\d,]+\.[\d]{2})`)
	// Conceptos con monto: "PROF. POR HORA 29.30" o "CODIGO DESCRIPCION MONTO"
	reConceptoFlex = regexp.MustCompile(`(?i)(PROF\.?\s*(?:DE\s*AULA|POR\s*HORA)?|[A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,}){0,3})\s+([\d,]+\.[\d]{2})`)

	// UGEL Chincha
	reUGEL        = regexp.MustCompile(`(?i)UNIDAD\s*DE\s*GESTI[ÓO]N\s*EDUCATIVA\s*LOCAL\s*[-–]\s*CHINCHA`)
	reDRE         = regexp.MustCompile(`(?i)DIRECCI[ÓO]N\s*REGIONAL\s*DE\s*EDUCACI[ÓO]N`)
	reGobReg      = regexp.MustCompile(`(?i)GOBIERNO\s*REGIONAL\s*[-–]\s*ICA`)

	// Institución
	reInstitucion = regexp.MustCompile(`(?i)(?:COLEGIO|I\.?\s*E\.?|INSTITUCI[ÓO]N\s*EDUCATIVA|C\.?E\.?|CEBA|CEBE)\s*(?:N[°º]?\s*)?[\w\s]+`)

	mesesNombre = map[string]int{
		"ENERO": 1, "FEBRERO": 2, "MARZO": 3, "ABRIL": 4,
		"MAYO": 5, "JUNIO": 6, "JULIO": 7, "AGOSTO": 8,
		"SETIEMBRE": 9, "SEPTIEMBRE": 9, "OCTUBRE": 10,
		"NOVIEMBRE": 11, "DICIEMBRE": 12,
	}
)

type BoletaParser struct{}

func NewBoletaParser() *BoletaParser {
	return &BoletaParser{}
}

func (p *BoletaParser) Parse(rawText string) (*model.BoletaScanResult, error) {
	result := &model.BoletaScanResult{
		RawText: rawText,
	}

	// Limpiar texto
	text := strings.ReplaceAll(rawText, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	lines := strings.Split(text, "\n")

	// 1. Extraer nombre
	result.NombreCompleto = extractFirst(reNombre, text)

	// 2. Extraer código modular
	result.CodigoModular = extractFirst(reCodModular, text)

	// 3. Extraer centro de trabajo / institución
	result.Institucion = extractFirst(reCentroTrab, text)
	if result.Institucion == "" {
		result.Institucion = extractFirst(reInstitucion, text)
	}

	// 4. Extraer nivel
	result.Nivel = strings.ToUpper(extractFirst(reNivel, text))

	// 5. Extraer establecimiento
	result.Establecimiento = extractFirst(reEstablec, text)

	// 6. Extraer período (año y mes)
	periodoMatch := rePeriodo.FindStringSubmatch(text)
	if len(periodoMatch) >= 3 {
		result.Anio, _ = strconv.Atoi(periodoMatch[1])
		result.Mes = mesesNombre[strings.ToUpper(periodoMatch[2])]
	}

	// 7. Extraer totales
	result.TotalHaberes = extractMonto(reTHaberes, text)
	result.TotalDescuentos = extractMonto(reTDescuento, text)
	result.TotalLiquido = extractMonto(reLiquido, text)
	result.MontoImponible = extractMonto(reImponible, text)

	// 8. Extraer haberes y descuentos de cada línea
	result.Haberes, result.Descuentos = p.extractConceptos(lines)

	// 9. Si los totales están vacíos, calcularlos de los conceptos
	if result.TotalHaberes == 0 && len(result.Haberes) > 0 {
		for _, h := range result.Haberes {
			result.TotalHaberes += h.Monto
		}
	}
	if result.TotalDescuentos == 0 && len(result.Descuentos) > 0 {
		for _, d := range result.Descuentos {
			result.TotalDescuentos += d.Monto
		}
	}
	if result.TotalLiquido == 0 {
		result.TotalLiquido = result.TotalHaberes - result.TotalDescuentos
	}

	// 10. Fallback: buscar DNI (8 dígitos, excluyendo años)
	if result.CodigoModular == "" {
		result.CodigoModular = extractFirst(reDniFallback, text)
	}
	// 11. Fallback: buscar nombres en el texto OCR degradado
	if result.NombreCompleto == "" {
		// Estrategia 1: buscar nombres compuestos conocidos (ej: TEOFILA HAYDEE)
		result.NombreCompleto = extractFirst(reNombreMujer, text)
	}
	if result.NombreCompleto == "" {
		// Estrategia 2: buscar apellido(s) + nombre(s)
		result.NombreCompleto = extractFirst(reNombrePersona, text)
	}
	// 12. Fallback: buscar periodo como "2025" cerca de "MES"
	if result.Anio == 0 {
		result.Anio, result.Mes = extractPeriodoFallback(text)
	}
	// 13. Fallback: extraer conceptos flexibles (PROF. POR HORA 29.30)
	if len(result.Haberes) == 0 {
		result.Haberes = extractConceptosFlexibles(text)
	}
	// 14. Sumar totales de conceptos si no se encontraron totales explícitos
	if result.TotalHaberes == 0 {
		for _, h := range result.Haberes {
			result.TotalHaberes += h.Monto
		}
	}
	if result.TotalLiquido == 0 {
		result.TotalLiquido = extractFirstMonto(reLiquidoFallback, text)
	}
	if result.TotalLiquido == 0 && result.TotalHaberes > 0 {
		result.TotalLiquido = result.TotalHaberes - result.TotalDescuentos
	}

	// Validar: al menos necesitamos algún dato del empleado O montos
	if result.NombreCompleto == "" && result.CodigoModular == "" &&
		result.TotalHaberes == 0 && result.TotalLiquido == 0 {
		return result, fmt.Errorf("no se pudo extraer datos del empleado de la boleta")
	}

	return result, nil
}

func (p *BoletaParser) extractConceptos(lines []string) (haberes []model.ConceptoBoleta, descuentos []model.ConceptoBoleta) {
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Detectar cambio de sección en la boleta
		if strings.Contains(strings.ToUpper(line), "T.HABERES") ||
			strings.Contains(strings.ToUpper(line), "TOTAL HABERES") {
			continue
		}

		matches := reConcepto2.FindAllStringSubmatch(line, -1)
		for _, m := range matches {
			if len(m) >= 4 {
				codigo := strings.TrimSpace(m[1])
				concepto := strings.TrimSpace(m[2])
				monto := parseMonto(m[3])

				if monto <= 0 {
					continue
				}

				cb := model.ConceptoBoleta{
					Codigo:   codigo,
					Concepto: concepto,
					Monto:    monto,
				}

				if strings.HasPrefix(codigo, "-") || strings.HasPrefix(codigo, "—") {
					descuentos = append(descuentos, cb)
				} else {
					haberes = append(haberes, cb)
				}
			}
		}
	}

	return haberes, descuentos
}

func (p *BoletaParser) ValidateUGEL(text string) bool {
	return reUGEL.MatchString(text) ||
		(strings.Contains(strings.ToUpper(text), "CHINCHA") &&
			(strings.Contains(strings.ToUpper(text), "UGEL") ||
				strings.Contains(strings.ToUpper(text), "UNIDAD DE GESTIÓN")))
}

func extractFirst(re *regexp.Regexp, text string) string {
	matches := re.FindStringSubmatch(text)
	if len(matches) >= 2 {
		return strings.TrimSpace(matches[1])
	}
	return ""
}

func extractFirstMonto(re *regexp.Regexp, text string) float64 {
	matches := re.FindStringSubmatch(text)
	if len(matches) >= 2 {
		return parseMonto(matches[1])
	}
	return 0
}

// extractConceptosFlexibles busca patrones como "PROF. POR HORA 29.30"
func extractConceptosFlexibles(text string) []model.ConceptoBoleta {
	var conceptos []model.ConceptoBoleta
	matches := reConceptoFlex.FindAllStringSubmatch(text, -1)
	for _, m := range matches {
		if len(m) >= 3 {
			concepto := strings.TrimSpace(m[1])
			monto := parseMonto(m[2])
			if monto > 0 && len(concepto) >= 2 {
				conceptos = append(conceptos, model.ConceptoBoleta{
					Codigo:   "",
					Concepto: concepto,
					Monto:    monto,
				})
			}
		}
	}
	return conceptos
}

func extractMonto(re *regexp.Regexp, text string) float64 {
	matches := re.FindStringSubmatch(text)
	if len(matches) >= 2 {
		return parseMonto(matches[1])
	}
	return 0
}

// extractPeriodoFallback busca año y mes en formatos menos estructurados
func extractPeriodoFallback(text string) (int, int) {
	// Buscar "MES" seguido de un mes o un mes seguido de año
	for mesNombre, mesNum := range mesesNombre {
		pat := regexp.MustCompile(`(?i)` + mesNombre + `\s*(?:DE\s*)?(\d{4})`)
		if m := pat.FindStringSubmatch(text); len(m) >= 2 {
			anio, _ := strconv.Atoi(m[1])
			return anio, mesNum
		}
	}
	// Buscar año de 4 dígitos en el rango 1990-2030
	patAnio := regexp.MustCompile(`\b(19[9]\d|20[0-2]\d)\b`)
	if m := patAnio.FindStringSubmatch(text); len(m) >= 2 {
		anio, _ := strconv.Atoi(m[1])
		return anio, 0
	}
	return 0, 0
}

func parseMonto(s string) float64 {
	s = strings.ReplaceAll(s, ",", "")
	s = strings.TrimSpace(s)
	v, _ := strconv.ParseFloat(s, 64)
	return v
}
