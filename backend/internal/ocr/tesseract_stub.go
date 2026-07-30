//go:build !cgo

package ocr

import (
	"fmt"
	"os"
	"os/exec"
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
	cmd := exec.Command("convert",
		inputPath,
		"-colorspace", "Gray",
		"-deskew", "40%",
		"-normalize",
		"-contrast-stretch", "5%x1%",
		"-sharpen", "0x1.5",
		"-noise", "3",
		"-resize", "250%",
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
