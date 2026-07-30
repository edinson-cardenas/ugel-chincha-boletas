//go:build cgo

package ocr

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/otiai10/gosseract/v2"
)

type TesseractOCR struct{}

func NewTesseractOCR() *TesseractOCR {
	return &TesseractOCR{}
}

func (t *TesseractOCR) ExtractText(imagePath string) (string, float64, error) {
	client := gosseract.NewClient()
	defer client.Close()

	client.SetLanguage("spa+eng")
	client.SetPageSegMode(gosseract.PSM_AUTO)
	client.SetImage(imagePath)

	text, err := client.Text()
	if err != nil {
		return "", 0, fmt.Errorf("tesseract: error extrayendo texto: %w", err)
	}

	// gosseract v2 no tiene GetTextConfidence; estimamos confianza
	// basado en si se extrajo texto válido
	confidence := 0.85
	if strings.TrimSpace(text) == "" {
		confidence = 0.0
	}

	if strings.TrimSpace(text) == "" {
		client.SetPageSegMode(gosseract.PSM_SINGLE_BLOCK)
		text, err = client.Text()
		if err != nil {
			return "", 0, fmt.Errorf("tesseract: error en segundo intento: %w", err)
		}
	}

	return text, confidence, nil
}

func (t *TesseractOCR) IsAvailable() bool {
	client := gosseract.NewClient()
	defer client.Close()
	client.SetLanguage("spa")
	_, err := client.Text()
	return err == nil
}

func PreprocessImage(inputPath, outputPath string) error {
	// Preprocesamiento para mejorar OCR en fotos de documentos
	// 1. Escala de grises + deskew (corregir rotación)
	// 2. Normalizar contraste
	// 3. Aumentar resolución para mejor OCR
	cmd := exec.Command("convert",
		inputPath,
		"-colorspace", "Gray",
		"-deskew", "40%",
		"-auto-level",
		"-contrast-stretch", "2%x1%",
		"-sharpen", "0x1.5",
		"-resize", "250%",
		"-quality", "100",
		outputPath,
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("error preprocesando imagen: %w - %s", err, string(output))
	}
	return nil
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}
