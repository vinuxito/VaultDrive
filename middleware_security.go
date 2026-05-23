package main

import "net/http"

// middlewareSecurityHeaders adds production-grade security headers to every
// response. This covers OWASP recommendations for:
//   - Content-Security-Policy: prevents XSS and injection attacks
//   - Strict-Transport-Security: enforces HTTPS
//   - X-Content-Type-Options: prevents MIME-type sniffing
//   - X-Frame-Options: prevents clickjacking
//   - Referrer-Policy: limits information leakage
//   - Permissions-Policy: disables unused browser features
//   - X-DNS-Prefetch-Control: prevents DNS-based tracking
func middlewareSecurityHeaders(next http.Handler) http.Handler {
	// CSP built once at startup — no per-request allocation.
	csp := "default-src 'self'; " +
		"script-src 'self' 'unsafe-inline'; " + // unsafe-inline needed for theme preload script in index.html
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
		"font-src 'self' https://fonts.gstatic.com; " +
		"img-src 'self' data: blob:; " +
		"connect-src 'self'; " +
		"frame-ancestors 'none'; " +
		"base-uri 'self'; " +
		"form-action 'self'"

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", csp)
		w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("X-DNS-Prefetch-Control", "off")

		next.ServeHTTP(w, r)
	})
}
