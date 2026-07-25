package ocr

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"planillas-backend/internal/model"
)

type Scanner struct {
	tesseract    *TesseractOCR
	googleVision *GoogleVisionOCR
	parser       *BoletaParser
	confidenceThreshold float64
}

func NewScanner(googleCredentialsFile string) *Scanner {
	return &Scanner{
		tesseract:           NewTesseractOCR(),
		googleVision:        NewGoogleVisionOCR(googleCredentialsFile),
		parser:              NewBoletaParser(),
		confidenceThreshold: 0.75,
	}
}

func (s *Scanner) ScanImage(imagePath string) (*model.BoletaScanResult, error) {
	var text string
	var confidence float64
	var engine string

	// Primero intentar con Tesseract (local, rápido, gratis)
	log.Printf("[OCR] Procesando con Tesseract: %s", imagePath)
	text, confidence, err := s.tesseract.ExtractText(imagePath)

	if err != nil || confidence < s.confidenceThreshold {
		if s.googleVision.IsAvailable() {
			log.Printf("[OCR] Tesseract confidence %.2f < %.2f, intentando Google Vision...",
				confidence, s.confidenceThreshold)
			text2, conf2, err2 := s.googleVision.ExtractText(imagePath)
			if err2 == nil && (conf2 > confidence || conf2 > s.confidenceThreshold) {
				text = text2
				confidence = conf2
				engine = "google_vision"
				log.Printf("[OCR] Google Vision confidence: %.2f", confidence)
			} else if err2 != nil {
				log.Printf("[OCR] Google Vision falló: %v, usando resultado de Tesseract", err2)
			}
		} else if err != nil {
			return nil, fmt.Errorf("Tesseract no disponible y Google Vision no configurado. Instala tesseract-ocr o configura GOOGLE_APPLICATION_CREDENTIALS")
		}
	}

	if engine == "" && err == nil {
		engine = "tesseract"
	}

	if text == "" {
		return nil, fmt.Errorf("no se pudo extraer texto de la imagen")
	}

	log.Printf("[OCR] Texto extraído (%d chars, engine=%s, conf=%.2f)", len(text), engine, confidence)

	result, err := s.parser.Parse(text)
	if err != nil {
		return nil, fmt.Errorf("error parseando boleta: %w", err)
	}

	result.OcrEngine = engine
	result.OcrConfidence = confidence

	return result, nil
}

func (s *Scanner) ScanBatch(imagePaths []string) ([]*model.BoletaScanResult, []error) {
	results := make([]*model.BoletaScanResult, 0, len(imagePaths))
	errs := make([]error, 0)

	for i, path := range imagePaths {
		log.Printf("[OCR] Procesando %d/%d: %s", i+1, len(imagePaths), path)
		result, err := s.ScanImage(path)
		if err != nil {
			errs = append(errs, fmt.Errorf("error en %s: %w", filepath.Base(path), err))
			continue
		}
		results = append(results, result)
	}

	return results, errs
}

func (s *Scanner) SaveUploadedFile(file io.Reader, originalName string) (string, error) {
	uploadDir := "uploads/ocr"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return "", fmt.Errorf("error creando directorio: %w", err)
	}

	timestamp := time.Now().UnixNano()
	ext := filepath.Ext(originalName)
	if ext == "" {
		ext = ".jpg"
	}
	filename := fmt.Sprintf("%s/%d%s", uploadDir, timestamp, ext)

	dst, err := os.Create(filename)
	if err != nil {
		return "", fmt.Errorf("error creando archivo: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", fmt.Errorf("error guardando archivo: %w", err)
	}

	return filename, nil
}
