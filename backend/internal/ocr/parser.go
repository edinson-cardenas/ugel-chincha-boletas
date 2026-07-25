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

	if result.NombreCompleto == "" && result.CodigoModular == "" {
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

func extractMonto(re *regexp.Regexp, text string) float64 {
	matches := re.FindStringSubmatch(text)
	if len(matches) >= 2 {
		return parseMonto(matches[1])
	}
	return 0
}

func parseMonto(s string) float64 {
	s = strings.ReplaceAll(s, ",", "")
	s = strings.TrimSpace(s)
	v, _ := strconv.ParseFloat(s, 64)
	return v
}
