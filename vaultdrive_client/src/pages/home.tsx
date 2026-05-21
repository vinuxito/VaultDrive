import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "../components/ui/button";
import {
  Shield,
  Lock,
  Database,
  Github,
  FileUp,
  Key,
  Share2,
  CheckCircle2,
  Users,
} from "lucide-react";
import { BrandLogo, LandingPageFooter } from "../components/branding";
import { useNavigate } from "react-router-dom";
import { branding } from "../config/branding";

/* ─── Scroll-triggered fade-in hook ─── */
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── Feature card data ─── */
const features = [
  {
    icon: Shield,
    title: "Zero-Knowledge Auth",
    desc: "Your private key never leaves your browser. We can't read your data — even if we wanted to.",
    color: "text-primary", bg: "bg-primary/10",
  },
  {
    icon: FileUp,
    title: "Encrypt-Before-Upload",
    desc: "Every file is AES-256-GCM encrypted in your browser before it touches our server. Period.",
    color: "text-green-500", bg: "bg-green-500/10",
  },
  {
    icon: Lock,
    title: "Cryptographic Sharing",
    desc: "Share files using RSA-2048 key exchange. Recipients decrypt in their browser — no plaintext on the wire.",
    color: "text-purple-500", bg: "bg-purple-500/10",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    desc: "Groups, drop portals, upload links, and audit trails. Enterprise workflows without enterprise friction.",
    color: "text-pink-500", bg: "bg-pink-500/10",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const featuresSection = useInView(0.08);
  const techSection = useInView(0.08);
  const trustSection = useInView(0.15);

  /* Encryption trust signal — cycling animation */
  const trustLines = [
    "AES-256-GCM · client-side encryption",
    "RSA-2048 · key exchange",
    "Zero plaintext on server",
    "Auditable · verifiable · open",
  ];
  const [trustIdx, setTrustIdx] = useState(0);
  const advanceTrust = useCallback(() => {
    setTrustIdx((i) => (i + 1) % trustLines.length);
  }, [trustLines.length]);
  useEffect(() => {
    const id = setInterval(advanceTrust, 2500);
    return () => clearInterval(id);
  }, [advanceTrust]);

  return (
    <div className="brand-page-bg">
      {/* Hero Section — animated gradient background */}
      <section className="brand-hero-bg hero-animated-bg">
        <div className="container mx-auto px-4 py-20 md:py-28" style={{ position: "relative", zIndex: 1 }}>
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="flex items-center justify-center mb-6">
              <BrandLogo className="w-32 h-32 drop-shadow-2xl" />
            </div>

            <div className="brand-badge">
              <Shield style={{ width: "0.875rem", height: "0.875rem" }} />
              Zero-Knowledge · Encrypted · Auditable
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight brand-gradient-text" style={{ lineHeight: 1.15 }}>
              {branding.companyName}
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Your files are encrypted in your browser before they ever touch our server.
              We can&apos;t read them. Nobody can. Store, share, and collaborate on sensitive data
              with military-grade encryption — and we&apos;ll prove it.
            </p>

            {/* Encryption trust signal — cycling badge */}
            <div className="flex items-center justify-center gap-2 text-sm text-primary/80 font-mono">
              <Lock className="w-3.5 h-3.5" />
              <span key={trustIdx} className="stat-card-enter">
                {trustLines[trustIdx]}
              </span>
            </div>

            <div className="flex gap-3 justify-center pt-4 flex-wrap">
              <Button
                className="gap-2 brand-btn-ghost"
                onClick={() =>
                  window.open("https://github.com/Pranay0205/VaultDrive", "_blank")
                }
              >
                <Github className="w-4 h-4" />
                View on GitHub
              </Button>
              <Button
                className="gap-2 brand-btn-primary"
                onClick={() => navigate("/login")}
              >
                Get Started →
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Overview — scroll-triggered */}
      <section className="container mx-auto px-4 py-16">
        <div
          ref={featuresSection.ref}
          className={`max-w-5xl mx-auto scroll-fade-in ${featuresSection.inView ? "in-view" : ""}`}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 brand-section-heading">
            Why Zero-Knowledge Matters
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="brand-glass-card p-6 scroll-fade-in"
                style={{
                  transitionDelay: featuresSection.inView ? `${i * 80}ms` : "0ms",
                  opacity: featuresSection.inView ? 1 : 0,
                  transform: featuresSection.inView ? "translateY(0)" : "translateY(20px)",
                }}
              >
                <div className={`w-12 h-12 rounded-lg ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Trust Signal */}
      <section className="container mx-auto px-4 py-12">
        <div
          ref={trustSection.ref}
          className={`max-w-3xl mx-auto scroll-fade-in ${trustSection.inView ? "in-view" : ""}`}
        >
          <div className="brand-glass-card p-8">
            <h2 className="text-xl font-semibold mb-6 brand-section-heading text-center">
              Provable Security Architecture
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: "Client-side AES-256-GCM encryption", done: true },
                { label: "RSA-2048 key exchange for sharing", done: true },
                { label: "PIN-gated key vault with envelope encryption", done: true },
                { label: "Server never sees plaintext — zero-knowledge", done: true },
                { label: "Scoped, revocable agent API keys", done: true },
                { label: "Full audit trail on every action", done: true },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack — scroll-triggered */}
      <section className="container mx-auto px-4 py-16">
        <div
          ref={techSection.ref}
          className={`max-w-5xl mx-auto scroll-fade-in ${techSection.inView ? "in-view" : ""}`}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 brand-section-heading">
            Technology Stack
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="brand-glass-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Backend</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Go (Golang) — REST API server</li>
                    <li>• PostgreSQL — Relational database</li>
                    <li>• SQLC — Type-safe SQL queries</li>
                    <li>• Goose — Database migrations</li>
                    <li>• JWT — Token-based authentication</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="brand-glass-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Key className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Frontend</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• React 18 — UI framework</li>
                    <li>• TypeScript — Type safety</li>
                    <li>• Vite — Build tool</li>
                    <li>• Tailwind CSS — Styling</li>
                    <li>• shadcn/ui — Component library</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="brand-glass-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Share2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Security</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• AES-256-GCM — File encryption</li>
                    <li>• RSA-2048 — Key exchange</li>
                    <li>• bcrypt — Password hashing</li>
                    <li>• Rate limiting — Brute-force protection</li>
                    <li>• i18n — EN / ES-MX multilingual</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="brand-glass-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Key className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Developer Experience</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Agent API keys — Scoped delegation</li>
                    <li>• Playwright E2E — 41 automated tests</li>
                    <li>• Vitest — 116 unit tests</li>
                    <li>• 6 premium CSS themes</li>
                    <li>• Downstream branding overlays</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingPageFooter />
    </div>
  );
}
