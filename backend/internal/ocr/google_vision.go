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
	if g.credentialsFile == "" {
		return false
	}
	if _, err := os.Stat(g.credentialsFile); os.IsNotExist(err) {
		return false
	}
	envCreds := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	if g.credentialsFile != "" {
		envCreds = g.credentialsFile
	}
	return envCreds != ""
}

func (g *GoogleVisionOCR) ExtractText(imagePath string) (string, float64, error) {
	ctx := context.Background()

	credsFile := g.credentialsFile
	if credsFile == "" {
		credsFile = os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	}
	if credsFile != "" {
		os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", credsFile)
	}

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
