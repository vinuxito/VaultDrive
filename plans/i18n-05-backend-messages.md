# Step 5: Backend Error Messages (Go)

**Objective:** Ensure that when API calls fail or return validation errors, the text supplied by the Go backend aligns with the user's selected language.

## Action Plan

### 1. Parse `Accept-Language` Header
- Create a Go middleware that reads the `Accept-Language` HTTP header.
- If it starts with `es`, store the language context (e.g., `es-MX`) in the request's context (`r.Context()`). Default to `en`.

### 2. Implement an Error Dictionary Map
- Do not implement a massive i18n library in Go. Keep it simple and performant.
- Create a `messages` package with a map of translation keys to localized strings.
  ```go
  var Errors = map[string]map[string]string{
      "en": {
          "ErrInvalidCredentials": "Login failed. Please check your email and password.",
          "ErrFileNotFound": "The requested file could not be found.",
          "ErrRateLimit": "Too many requests. Please try again later.",
      },
      "es": {
          "ErrInvalidCredentials": "Error al iniciar sesión. Verifica tu correo y contraseña.",
          "ErrFileNotFound": "No se pudo encontrar el archivo solicitado.",
          "ErrRateLimit": "Demasiadas peticiones. Por favor, intenta de nuevo más tarde.",
      },
  }
  ```

### 3. Refactor HTTP Handlers
- Update the HTTP handlers (e.g., `handle_login.go`, `handle_files.go`) to fetch the requested language from the context.
- When an error occurs, look up the translation key from the map and construct the JSON error response with the localized text.

## Verification
- Trigger a failed login using curl or Postman with `Accept-Language: es` and verify the JSON response contains the Spanish error message.
- Verify the same request with `Accept-Language: en` (or omitted) returns English.
