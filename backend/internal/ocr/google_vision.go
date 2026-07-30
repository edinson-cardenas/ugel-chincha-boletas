package ocr

import (
	"context"
	"fmt"
	"os"

	vision "cloud.google.com/go/vision/v2/apiv1"
	"cloud.google.com/go/vision/v2/apiv1/visionpb"
)

type GoogleVisionOCR struct {
	credentialsFile string
}

func NewGoogleVisionOCR(credentialsFile string) *GoogleVisionOCR {
	return &GoogleVisionOCR{
		credentialsFile: credentialsFile,
	}
}

func (g *GoogleVisionOCR) IsAvailable() bool {
	// Si hay archivo de credenciales explícito, verificar que exista
	if g.credentialsFile != "" {
		if _, err := os.Stat(g.credentialsFile); err == nil {
			return true
		}
	}
	// Si hay variable de entorno GOOGLE_APPLICATION_CREDENTIALS, verificar que exista
	if envCreds := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"); envCreds != "" {
		if _, err := os.Stat(envCreds); err == nil {
			return true
		}
	}
	// Intentar ADC (Application Default Credentials) - gcloud auth application-default login
	// Verificamos si existe el archivo de ADC estándar
	homeDir, _ := os.UserHomeDir()
	adcPath := homeDir + "/.config/gcloud/application_default_credentials.json"
	if _, err := os.Stat(adcPath); err == nil {
		return true
	}
	return false
}

func (g *GoogleVisionOCR) ExtractText(imagePath string) (string, float64, error) {
	ctx := context.Background()

	// Configurar credenciales: archivo explícito > env var > ADC
	if g.credentialsFile != "" {
		if _, err := os.Stat(g.credentialsFile); err == nil {
			os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", g.credentialsFile)
		}
	}
	// Si no hay credenciales explícitas, NewImageAnnotatorClient usará ADC automáticamente

	client, err := vision.NewImageAnnotatorClient(ctx)
	if err != nil {
		return "", 0, fmt.Errorf("google vision: error creando cliente: %w", err)
	}
	defer client.Close()

	imageData, err := os.ReadFile(imagePath)
	if err != nil {
		return "", 0, fmt.Errorf("google vision: error leyendo imagen: %w", err)
	}

	image := &visionpb.Image{
		Content: imageData,
	}

	features := []*visionpb.Feature{
		{Type: visionpb.Feature_DOCUMENT_TEXT_DETECTION},
	}

	req := &visionpb.BatchAnnotateImagesRequest{
		Requests: []*visionpb.AnnotateImageRequest{
			{
				Image:    image,
				Features: features,
			},
		},
	}

	resp, err := client.BatchAnnotateImages(ctx, req)
	if err != nil {
		return "", 0, fmt.Errorf("google vision: error detectando texto: %w", err)
	}

	if len(resp.Responses) == 0 || resp.Responses[0].GetFullTextAnnotation() == nil {
		return "", 0, fmt.Errorf("google vision: sin resultado")
	}

	annotation := resp.Responses[0].GetFullTextAnnotation()
	fullText := annotation.GetText()

	var totalConfidence float64
	var blockCount int
	for _, page := range annotation.Pages {
		for _, block := range page.Blocks {
			totalConfidence += float64(block.Confidence)
			blockCount++
		}
	}

	confidence := 0.0
	if blockCount > 0 {
		confidence = totalConfidence / float64(blockCount)
	}

	return fullText, confidence, nil
}
