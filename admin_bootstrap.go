package main

import (
	"context"
	"log"
	"time"

	"github.com/lib/pq"
)

// bootstrapAdmins promotes any emails listed in ProductConfig.AdminBootstrap
// to admin. It runs once on server startup after the DB connection is live
// and is fully idempotent — safe to run every boot. This hook is the
// canonical way to grant admin access on new deployments; set
// ADMIN_BOOTSTRAP_EMAILS in the environment.
//
// The function logs but does not fail the server on error: admin bootstrap
// is a convenience, not a correctness requirement, and a transient DB
// hiccup should not prevent the server from starting.
func (cfg *ApiConfig) bootstrapAdmins() {
	if len(cfg.Product.AdminBootstrap) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res, err := cfg.db.ExecContext(ctx,
		`UPDATE users SET is_admin = TRUE WHERE email = ANY($1)`,
		pq.Array(cfg.Product.AdminBootstrap),
	)
	if err != nil {
		log.Printf("admin bootstrap: failed to promote %v: %v", cfg.Product.AdminBootstrap, err)
		return
	}
	affected, _ := res.RowsAffected()
	log.Printf("admin bootstrap: promoted %d user(s) from %d candidate email(s)", affected, len(cfg.Product.AdminBootstrap))
}
