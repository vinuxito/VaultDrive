import { Button } from "../components/ui/button";
import {
  Shield,
  Lock,
  Database,
  Github,
  FileUp,
  Key,
  Share2,
} from "lucide-react";
import { ABRNLogo, LandingPageFooter } from "../components/branding";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  return (
    <div className="abrn-page-bg">
      {/* Hero Section */}
      <section className="abrn-hero-bg">
        <div className="container mx-auto px-4 py-20 md:py-28" style={{ position: "relative", zIndex: 1 }}>
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="flex items-center justify-center mb-6">
              <ABRNLogo className="w-32 h-32 drop-shadow-2xl" />
            </div>

            <div className="abrn-badge">
              <Shield style={{ width: "0.875rem", height: "0.875rem" }} />
              Enterprise · Zero-Knowledge · Encrypted
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight abrn-gradient-text" style={{ lineHeight: 1.15 }}>
              ABRN Asesores
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Enterprise-grade secure cloud storage with zero-knowledge encryption.
              Built with cutting-edge technology for maximum privacy and security.
            </p>

            <div className="flex gap-3 justify-center pt-4 flex-wrap">
              <Button
                className="gap-2 abrn-btn-ghost"
                onClick={() =>
                  window.open("https://github.com/Pranay0205/VaultDrive", "_blank")
                }
              >
                <Github className="w-4 h-4" />
                View on GitHub
              </Button>
              <Button
                className="gap-2 abrn-btn-primary"
                onClick={() => navigate("/login")}
              >
                Get Started →
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 abrn-section-heading">
            Core Features
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="abrn-glass-card p-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Secure Authentication</h3>
              <p className="text-sm text-muted-foreground">
                JWT-based auth with bcrypt password hashing and refresh token rotation
              </p>
            </div>

            <div className="abrn-glass-card p-6">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                <FileUp className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">File Management</h3>
              <p className="text-sm text-muted-foreground">
                Upload, download, and manage files with complete CRUD operations
              </p>
            </div>

            <div className="abrn-glass-card p-6">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">Client-Side Encryption</h3>
              <p className="text-sm text-muted-foreground">
                AES-256-GCM encryption with password-based key derivation (PBKDF2)
              </p>
            </div>

            <div className="abrn-glass-card p-6">
              <div className="w-12 h-12 rounded-lg bg-pink-500/10 flex items-center justify-center mb-4">
                <Share2 className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="font-semibold mb-2">Secure File Sharing</h3>
              <p className="text-sm text-muted-foreground">
                Share encrypted files with other users using public key cryptography
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 abrn-section-heading">
            Technology Stack
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="abrn-glass-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Backend</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Go (Golang) - REST API server</li>
                    <li>• PostgreSQL - Relational database</li>
                    <li>• SQLC - Type-safe SQL queries</li>
                    <li>• Goose - Database migrations</li>
                    <li>• JWT - Token-based authentication</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="abrn-glass-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Key className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Frontend</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• React 18 - UI framework</li>
                    <li>• TypeScript - Type safety</li>
                    <li>• Vite - Build tool</li>
                    <li>• Tailwind CSS - Styling</li>
                    <li>• shadcn/ui - Component library</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About ABRN Drive */}
      <section className="container mx-auto px-4 py-16 mb-12">
        <div className="max-w-3xl mx-auto">
          <div className="abrn-glass-card p-8">
            <h2 className="text-xl font-semibold mb-4 abrn-section-heading">
              About ABRN Drive
            </h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                ABRN Drive is an enterprise-grade zero-knowledge encrypted cloud storage platform
                designed for businesses that demand maximum privacy and security.
              </p>
              <p>
                Built with modern technologies including Go, React 19, PostgreSQL, and industry-standard
                encryption protocols (RSA-2048, AES-256-GCM), ensuring your data remains private.
              </p>
              <p className="pt-2">
                <strong className="text-foreground">Key Features:</strong>{" "}
                Zero-knowledge encryption, secure file sharing, team collaboration,
                integrated email support, and comprehensive audit logging.
              </p>
            </div>
          </div>
        </div>
      </section>

      <LandingPageFooter />
    </div>
  );
}
