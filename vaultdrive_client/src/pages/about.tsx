import { Shield, Users, Target } from "lucide-react";
import VaultIcon from "../components/ui/vault-icon";

export default function About() {
  return (
    <div className="abrn-page-bg py-16">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-4">
            <VaultIcon className="w-20 h-20 drop-shadow-xl" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 abrn-gradient-text">
            About ABRN Drive
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A secure file exchange workspace built for calm, controlled collaboration.
          </p>
        </div>

        {/* Project Motivation */}
        <div className="abrn-glass-card p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Why It Exists</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              ABRN Drive exists to remove the tension that comes with handling sensitive files.
              Teams should be able to share documents, receive client uploads, and review access
              without falling back to insecure shortcuts.
            </p>
            <p>
              The platform is built around three promises: protect the file,
              make access boundaries clear, and keep the workflow lightweight enough
              that people actually use it every day.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Protect sensitive files before and during transfer</li>
              <li>Make sharing and client dropoffs feel deliberate and trustworthy</li>
              <li>Give owners clear visibility into activity and access</li>
              <li>Reduce friction so secure handling becomes the default habit</li>
              <li>Keep the experience calm for both internal users and external clients</li>
            </ul>
            <p>
              The result is meant to feel less like a generic file app and more like
              a dependable place to get sensitive work done.
            </p>
          </div>
        </div>

        {/* Team Section */}
        <div className="abrn-glass-card p-8 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Platform Principles</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">What the product should make obvious on every screen</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="abrn-glass-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">01</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Trust First</h3>
                  <p className="text-sm text-muted-foreground">Every file exchange should feel legitimate and understandable</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Clients and partners should know who they are sending to, what happens to the files,
                and how access is controlled before they ever click upload.
              </p>
            </div>

            <div className="abrn-glass-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">02</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Security Without Drama</h3>
                  <p className="text-sm text-muted-foreground">Protection should be strong, visible, and low-friction</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Strong encryption, clear permissions, safer defaults, and quiet operational visibility
                should reduce pressure instead of adding more ceremony.
              </p>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="abrn-glass-card p-8 mb-8">
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
        <div className="abrn-glass-card p-8 mb-8">
          <h2 className="text-xl font-semibold mb-6">Key Features</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "Secure Authentication", desc: "JWT-based authentication with refresh tokens and bcrypt password hashing" },
              { title: "File Management", desc: "Upload, download, and manage files with metadata tracking" },
              { title: "User Dashboard", desc: "Intuitive interface for managing your files and account" },
              { title: "Theme Support", desc: "Dark and light mode with persistent user preference" },
            ].map((f) => (
              <div key={f.title} className="flex gap-3">
                <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: "#7d4f50" }} />
                <div>
                  <h4 className="font-semibold mb-1">{f.title}</h4>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
