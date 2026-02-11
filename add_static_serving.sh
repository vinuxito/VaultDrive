#!/bin/bash
# Find line with ListenAndServe and insert static file serving before it
sed -i '414i\
\
\	// Serve static frontend files (SPA)\
\	httpFS := http.FileServer(http.Dir("vaultdrive_client/dist"))\
\	mux.Handle("/", httpFS)\
\
\	// SPA routing fallback - serve index.html for non-API routes\
\	mux.HandleFunc("/*", func(w http.ResponseWriter, r *http.Request) {\
\		path := r.URL.Path\
\		// Don"'"'t handle API requests here\
\		if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/abrn/") {\
\			return\
\		}\
\		_, err := os.Stat(filepath.Join("vaultdrive_client/dist", path))\
\		if os.IsNotExist(err) {\
\			// File not found, serve index.html for SPA routing\
\			r.URL.Path = "/"\
\		}\
\		httpFS.ServeHTTP(w, r)\
\	})\
\
' main.go
