FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server

FROM alpine:3.20

RUN apk add --no-cache \
    ca-certificates \
    tesseract-ocr \
    tesseract-ocr-data-spa \
    tesseract-ocr-data-eng

WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/plantilla_nueva.xlsx .

RUN mkdir -p uploads uploads/ocr

EXPOSE 8080

CMD ["./server"]
