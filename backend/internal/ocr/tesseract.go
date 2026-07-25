//go:build cgo

package ocr

import (
	"fmt"
	"os"
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

	confidence := client.GetTextConfidence() / 100.0

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
	return copyFile(inputPath, outputPath)
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}
