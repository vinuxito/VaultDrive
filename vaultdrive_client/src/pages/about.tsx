import { Shield, Users, Target, Github } from "lucide-react";
import { Button } from "../components/ui/button";
import VaultIcon from "../components/ui/vault-icon";
import { branding } from "../config/branding";

export default function About() {
  return (
    <div className="brand-page-bg py-16">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-4">
            <VaultIcon className="w-20 h-20 drop-shadow-xl" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 brand-gradient-text">
            About {branding.productName}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Browser-encrypted file storage with visible access controls,
            recoverable workflows, and an auditable history.
          </p>
        </div>

        {/* Project Motivation */}
        <div className="brand-glass-card p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Project Motivation</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              In today's digital age, data security and privacy have become
              paramount concerns. With increasing cyber threats and data
              breaches, there's a growing need for secure file storage solutions
              that individuals can trust with their sensitive information.
            </p>
            <p>
              {branding.productName} was created to make encrypted file storage
              understandable in day-to-day work. The product combines:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Secure authentication using JWT tokens and bcrypt password hashing</li>
              <li>RESTful API design with proper error handling and validation</li>
              <li>Database management with type-safe queries using SQLC</li>
              <li>Modern frontend development with React and TypeScript</li>
              <li>Responsive UI design with Tailwind CSS and shadcn/ui components</li>
            </ul>
            <p>
              Security claims are tied to the actual access path. Secure Drop,
              account sharing, link sharing, and recovery can have different
              credentials and limits; the interface and Help Center explain
              those differences where the user acts.
            </p>
          </div>
        </div>

        {/* Product principles */}
        <div className="brand-glass-card p-8 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Product principles</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Clarity, control, and evidence at every step</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="brand-glass-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">01</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Understand the prompt</h3>
                  <p className="text-sm text-muted-foreground">Credentials stay specific to the task</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Account passwords, vault PINs, sender passwords, and link credentials are labeled by purpose.
              </p>
            </div>

            <div className="brand-glass-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">02</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Trust the result</h3>
                  <p className="text-sm text-muted-foreground">Confirmed outcomes remain visible</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Access, expiry, recovery limits, and operation status are stated without unsupported guarantees.
              </p>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="brand-glass-card p-8 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Technology Stack</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Built with modern, industry-standard technologies</p>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Backend</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Go (Golang)</li>
                <li>• PostgreSQL</li>
                <li>• SQLC</li>
                <li>• JWT Authentication</li>
                <li>• Bcrypt Hashing</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Frontend</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• React 18</li>
                <li>• TypeScript</li>
                <li>• Vite</li>
                <li>• React Router</li>
                <li>• Tailwind CSS</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Tools & Libraries</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• shadcn/ui</li>
                <li>• Lucide Icons</li>
                <li>• Goose (Migrations)</li>
                <li>• Git & GitHub</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Key Features */}
        <div className="brand-glass-card p-8 mb-8">
          <h2 className="text-xl font-semibold mb-6">Key Features</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "Secure Authentication", desc: "JWT-based authentication with refresh tokens and bcrypt password hashing" },
              { title: "File Management", desc: "Upload, download, and manage files with metadata tracking" },
              { title: "User Dashboard", desc: "Intuitive interface for managing your files and account" },
              { title: "Theme Support", desc: "Dark and light mode with persistent user preference" },
            ].map((f) => (
              <div key={f.title} className="flex gap-3">
                <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: "hsl(var(--primary))" }} />
                <div>
                  <h4 className="font-semibold mb-1">{f.title}</h4>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Button
            size="lg"
            className="gap-2 brand-btn-primary"
            onClick={() => window.open("https://github.com/vinuxito/VaultDrive", "_blank")}
          >
            <Github className="w-5 h-5" />
            View Source Code
          </Button>
        </div>
      </div>
    </div>
  );
}
