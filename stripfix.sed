103,105c\\
\t// SPA - Serve React frontend\\
\tmux.Handle("/abrn/", http.StripPrefix("/abrn/", http.FileServer(http.Dir("vaultdrive_client/dist"))))\\
\tmux.Handle("/", http.FileServer(http.Dir("vaultdrive_client/dist")))\\
.
