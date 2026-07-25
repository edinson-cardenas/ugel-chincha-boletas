//go:build !cgo

package ocr

import (
	"fmt"
	"os"
)

type TesseractOCR struct{}

func NewTesseractOCR() *TesseractOCR {
	return &TesseractOCR{}
}

func (t *TesseractOCR) ExtractText(imagePath string) (string, float64, error) {
	return "", 0, fmt.Errorf("tesseract: CGO no habilitado. Compila con CGO_ENABLED=1 o usa Docker")
}

func (t *TesseractOCR) IsAvailable() bool {
	return false
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
