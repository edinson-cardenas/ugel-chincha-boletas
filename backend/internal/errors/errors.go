package errors

import "errors"

var (
	ErrNotFound      = errors.New("recurso no encontrado")
	ErrDuplicate     = errors.New("registro duplicado")
	ErrUnauthorized  = errors.New("no autorizado")
	ErrBadRequest    = errors.New("datos inválidos")
	ErrInternal      = errors.New("error interno del servidor")
	ErrTooManyReqs   = errors.New("demasiados intentos")
	ErrTokenExpired  = errors.New("sesión expirada")
	ErrPasswordWeak  = errors.New("contraseña demasiado débil")
)

func HTTPStatus(err error) int {
	switch {
	case errors.Is(err, ErrNotFound):
		return 404
	case errors.Is(err, ErrDuplicate):
		return 409
	case errors.Is(err, ErrUnauthorized), errors.Is(err, ErrTokenExpired):
		return 401
	case errors.Is(err, ErrBadRequest), errors.Is(err, ErrPasswordWeak):
		return 400
	case errors.Is(err, ErrTooManyReqs):
		return 429
	default:
		return 500
	}
}
