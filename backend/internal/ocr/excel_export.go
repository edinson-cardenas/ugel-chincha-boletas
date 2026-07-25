package ocr

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"

	"planillas-backend/internal/model"

	"github.com/xuri/excelize/v2"
)

func GenerateBoletasExcel(boletas []model.BoletaOCR) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Boletas"
	f.SetSheetName("Sheet1", sheet)

	// Estilos
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"059669"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "left", Color: "059669", Style: 1},
			{Type: "right", Color: "059669", Style: 1},
			{Type: "top", Color: "059669", Style: 1},
			{Type: "bottom", Color: "059669", Style: 1},
		},
	})

	subHeaderStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 10, Color: "059669"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"ECFDF5"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "left", Color: "A7F3D0", Style: 1},
			{Type: "right", Color: "A7F3D0", Style: 1},
			{Type: "top", Color: "A7F3D0", Style: 1},
			{Type: "bottom", Color: "A7F3D0", Style: 1},
		},
	})

	moneyStyle, _ := f.NewStyle(&excelize.Style{
		NumFmt:    44, // S/. #,##0.00
		Alignment: &excelize.Alignment{Horizontal: "right"},
		Border: []excelize.Border{
			{Type: "left", Color: "E5E7EB", Style: 1},
			{Type: "right", Color: "E5E7EB", Style: 1},
			{Type: "top", Color: "E5E7EB", Style: 1},
			{Type: "bottom", Color: "E5E7EB", Style: 1},
		},
	})

	textStyle, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{Horizontal: "left", Vertical: "center", WrapText: true},
		Border: []excelize.Border{
			{Type: "left", Color: "E5E7EB", Style: 1},
			{Type: "right", Color: "E5E7EB", Style: 1},
			{Type: "top", Color: "E5E7EB", Style: 1},
			{Type: "bottom", Color: "E5E7EB", Style: 1},
		},
	})

	totalStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"F0FDF4"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "right"},
		Border: []excelize.Border{
			{Type: "left", Color: "059669", Style: 2},
			{Type: "right", Color: "059669", Style: 2},
			{Type: "top", Color: "059669", Style: 2},
			{Type: "bottom", Color: "059669", Style: 2},
		},
	})

	// Cabecera UGEL Chincha
	f.SetCellValue(sheet, "A1", "GOBIERNO REGIONAL DE ICA")
	f.SetCellValue(sheet, "A2", "DIRECCIÓN REGIONAL DE EDUCACIÓN")
	f.SetCellValue(sheet, "A3", "UNIDAD DE GESTIÓN EDUCATIVA LOCAL - CHINCHA")
	f.SetCellValue(sheet, "A4", "SISTEMA DE GESTIÓN DE PLANILLAS - OCR")

	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 14, Color: "059669"},
	})
	f.SetCellStyle(sheet, "A1", "A4", titleStyle)

	// Cabecera de columnas - Datos del empleado
	row := 6
	headers := []string{"#", "APELLIDOS Y NOMBRES", "CÓDIGO MODULAR", "DNI", "INSTITUCIÓN", "NIVEL", "AÑO", "MES"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, row)
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, headerStyle)
	}
	row++

	// Conceptos únicos de haberes y descuentos
	haberesSet := make(map[string]bool)
	descuentosSet := make(map[string]bool)
	for _, b := range boletas {
		var haberes []model.ConceptoBoleta
		json.Unmarshal([]byte(b.Haberes), &haberes)
		for _, h := range haberes {
			haberesSet[h.Codigo+" "+h.Concepto] = true
		}
		var descuentos []model.ConceptoBoleta
		json.Unmarshal([]byte(b.Descuentos), &descuentos)
		for _, d := range descuentos {
			descuentosSet[d.Codigo+" "+d.Concepto] = true
		}
	}

	haberesList := sortedKeys(haberesSet)
	descuentosList := sortedKeys(descuentosSet)

	// Escribir sub-headers de haberes
	col := 9 // después de las 8 columnas de datos
	for _, h := range haberesList {
		cell, _ := excelize.CoordinatesToCellName(col, 6)
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, subHeaderStyle)
		col++
	}

	// Sub-header descuentos
	for _, d := range descuentosList {
		cell, _ := excelize.CoordinatesToCellName(col, 6)
		f.SetCellValue(sheet, cell, d)
		f.SetCellStyle(sheet, cell, cell, subHeaderStyle)
		col++
	}

	// Totales
	totalesStart := col
	totLabels := []string{"TOTAL HABERES", "TOTAL DESC.", "LÍQUIDO", "M. IMPONIBLE"}
	for _, tl := range totLabels {
		cell, _ := excelize.CoordinatesToCellName(col, 6)
		f.SetCellValue(sheet, cell, tl)
		f.SetCellStyle(sheet, cell, cell, headerStyle)
		col++
	}

	// Datos
	var totalHaberesG, totalDescuentosG, totalLiquidoG float64
	for i, b := range boletas {
		row = 7 + i

		// Datos básicos
		setCell(f, sheet, row, 1, i+1, textStyle)
		setCell(f, sheet, row, 2, b.NombreCompleto, textStyle)
		setCell(f, sheet, row, 3, b.CodigoModular, textStyle)
		setCell(f, sheet, row, 4, b.DNI, textStyle)
		setCell(f, sheet, row, 5, b.Institucion, textStyle)
		setCell(f, sheet, row, 6, b.Nivel, textStyle)
		setCell(f, sheet, row, 7, b.Anio, textStyle)
		setCell(f, sheet, row, 8, b.Mes, textStyle)

		var haberes []model.ConceptoBoleta
		json.Unmarshal([]byte(b.Haberes), &haberes)
		haberesMap := make(map[string]float64)
		for _, h := range haberes {
			haberesMap[h.Codigo+" "+h.Concepto] = h.Monto
		}

		var descuentos []model.ConceptoBoleta
		json.Unmarshal([]byte(b.Descuentos), &descuentos)
		descuentosMap := make(map[string]float64)
		for _, d := range descuentos {
			descuentosMap[d.Codigo+" "+d.Concepto] = d.Monto
		}

		// Haberes
		col = 9
		for _, h := range haberesList {
			cell, _ := excelize.CoordinatesToCellName(col, row)
			if monto, ok := haberesMap[h]; ok {
				f.SetCellValue(sheet, cell, monto)
				f.SetCellStyle(sheet, cell, cell, moneyStyle)
			} else {
				f.SetCellStyle(sheet, cell, cell, textStyle)
			}
			col++
		}

		// Descuentos
		for _, d := range descuentosList {
			cell, _ := excelize.CoordinatesToCellName(col, row)
			if monto, ok := descuentosMap[d]; ok {
				f.SetCellValue(sheet, cell, monto)
				f.SetCellStyle(sheet, cell, cell, moneyStyle)
			} else {
				f.SetCellStyle(sheet, cell, cell, textStyle)
			}
			col++
		}

		// Totales
		cellTH, _ := excelize.CoordinatesToCellName(totalesStart, row)
		cellTD, _ := excelize.CoordinatesToCellName(totalesStart+1, row)
		cellTL, _ := excelize.CoordinatesToCellName(totalesStart+2, row)
		cellMI, _ := excelize.CoordinatesToCellName(totalesStart+3, row)

		f.SetCellValue(sheet, cellTH, b.TotalHaberes)
		f.SetCellValue(sheet, cellTD, b.TotalDescuentos)
		f.SetCellValue(sheet, cellTL, b.TotalLiquido)
		f.SetCellValue(sheet, cellMI, b.MontoImponible)
		f.SetCellStyle(sheet, cellTH, cellTH, moneyStyle)
		f.SetCellStyle(sheet, cellTD, cellTD, moneyStyle)
		f.SetCellStyle(sheet, cellTL, cellTL, moneyStyle)
		f.SetCellStyle(sheet, cellMI, cellMI, moneyStyle)

		totalHaberesG += b.TotalHaberes
		totalDescuentosG += b.TotalDescuentos
		totalLiquidoG += b.TotalLiquido
	}

	// Fila de totales generales
	totalRow := 7 + len(boletas)
	f.SetCellValue(sheet, fmt.Sprintf("A%d", totalRow), "TOTALES GENERALES")
	f.SetCellValue(sheet, fmt.Sprintf("%s%d", colName(totalesStart), totalRow), totalHaberesG)
	f.SetCellValue(sheet, fmt.Sprintf("%s%d", colName(totalesStart+1), totalRow), totalDescuentosG)
	f.SetCellValue(sheet, fmt.Sprintf("%s%d", colName(totalesStart+2), totalRow), totalLiquidoG)

	// Merge y estilo para el label
	f.MergeCell(sheet, fmt.Sprintf("A%d", totalRow), fmt.Sprintf("%s%d", colName(8), totalRow))
	for c := 1; c <= col-1; c++ {
		cell, _ := excelize.CoordinatesToCellName(c, totalRow)
		f.SetCellStyle(sheet, cell, cell, totalStyle)
	}

	// Auto-fit columns
	for c := 1; c <= col-1; c++ {
		colName, _ := excelize.ColumnNumberToName(c)
		f.SetColWidth(sheet, colName, colName, 18)
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("error escribiendo Excel: %w", err)
	}

	return buf.Bytes(), nil
}

func setCell(f *excelize.File, sheet string, row, col int, value interface{}, style int) {
	cell, _ := excelize.CoordinatesToCellName(col, row)
	f.SetCellValue(sheet, cell, value)
	f.SetCellStyle(sheet, cell, cell, style)
}

func sortedKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func colName(n int) string {
	name, _ := excelize.ColumnNumberToName(n)
	return name
}
