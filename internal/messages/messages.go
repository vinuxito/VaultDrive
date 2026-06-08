package messages

import (
	"context"
	"strings"
)

var Errors = map[string]map[string]string{
	"en": {
		"ErrInvalidCredentials": "Login failed. Please check your email and password.",
		"ErrFileNotFound":       "The requested file could not be found.",
		"ErrRateLimit":          "Too many requests. Please try again later.",
		"ErrMissingParams":      "Missing required parameters.",
		"ErrUserExists":         "A user with that email already exists.",
		"ErrWeakPassword":       "Password is too weak. Please use a stronger password.",
	},
	"es": {
		"ErrInvalidCredentials": "Error al iniciar sesión. Verifica tu correo y contraseña.",
		"ErrFileNotFound":       "No se pudo encontrar el archivo solicitado.",
		"ErrRateLimit":          "Demasiadas peticiones. Por favor, intenta de nuevo más tarde.",
		"ErrMissingParams":      "Faltan parámetros requeridos.",
		"ErrUserExists":         "Ya existe un usuario con ese correo electrónico.",
		"ErrWeakPassword":       "La contraseña es demasiado débil. Por favor, usa una más segura.",
	},
}

type langKey struct{}

// WithLanguage returns a new context with the given language string
func WithLanguage(ctx context.Context, lang string) context.Context {
	return context.WithValue(ctx, langKey{}, lang)
}

// GetLanguage returns the language from context. Defaults to "en".
func GetLanguage(ctx context.Context) string {
	val := ctx.Value(langKey{})
	if val == nil {
		return "en"
	}
	lang, ok := val.(string)
	if !ok {
		return "en"
	}
	if strings.HasPrefix(lang, "es") {
		return "es"
	}
	return "en"
}

// Get returns the localized message for the given key based on the language in context.
func Get(ctx context.Context, key string) string {
	lang := GetLanguage(ctx)
	dict, ok := Errors[lang]
	if !ok {
		dict = Errors["en"] // fallback to English
	}
	
	msg, ok := dict[key]
	if !ok {
		// fallback to English if key missing in target language
		if enMsg, enOk := Errors["en"][key]; enOk {
			return enMsg
		}
		return key // return key as ultimate fallback
	}
	return msg
}
