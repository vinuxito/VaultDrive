import { ArrowLeft, FolderOpen, Home } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { BrandLogo } from "../components/branding";
import { branding } from "../config/branding";

export default function NotFound() {
  const navigate = useNavigate();
  const isAuthenticated = Boolean(localStorage.getItem("token"));
  const recoveryPath = isAuthenticated ? "/files" : "/";
  const recoveryLabel = isAuthenticated ? "Go to my files" : "Go to home";
  const RecoveryIcon = isAuthenticated ? FolderOpen : Home;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-foreground">
      <div className="fixed inset-0 -z-10" style={{ background: "var(--gradient-page)" }} />
      <section className="w-full max-w-lg rounded-2xl border border-primary/15 bg-card p-8 text-center shadow-xl">
        <BrandLogo className="mx-auto mb-6 h-14" />
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">404</p>
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          This address does not exist in {branding.productName}. You can return to a known page without losing saved offline work.
        </p>
        <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go back
          </button>
          <Link
            to={recoveryPath}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <RecoveryIcon className="h-4 w-4" aria-hidden="true" />
            {recoveryLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
