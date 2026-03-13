import { Shield, Users, Target, Github } from "lucide-react";
import { Button } from "../components/ui/button";
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
            About VaultDrive
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A secure file storage solution built as a college project
            demonstrating modern web development practices
          </p>
        </div>

        {/* Project Motivation */}
        <div className="abrn-glass-card p-8 mb-8">
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
              VaultDrive was created to address these concerns by implementing
              industry-standard security practices in a practical, real-world
              application. Our goal was to build a system that not only stores
              files securely but also demonstrates best practices in:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Secure authentication using JWT tokens and bcrypt password hashing</li>
              <li>RESTful API design with proper error handling and validation</li>
              <li>Database management with type-safe queries using SQLC</li>
              <li>Modern frontend development with React and TypeScript</li>
              <li>Responsive UI design with Tailwind CSS and shadcn/ui components</li>
            </ul>
            <p>
              This project serves as a comprehensive learning experience,
              covering the full stack of web development—from database design
              and backend API development to frontend user interface and user
              experience design.
            </p>
          </div>
        </div>

        {/* Team Section */}
        <div className="abrn-glass-card p-8 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Development Team</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Computer Science Students · 2025</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="abrn-glass-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">PG</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Pranay Ghuge</h3>
                  <p className="text-sm text-muted-foreground">Full Stack Developer</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Full Stack Development, System Architecture, Security Implementation, and UI/UX Design
              </p>
            </div>

            <div className="abrn-glass-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">AD</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Arundhati Das</h3>
                  <p className="text-sm text-muted-foreground">Full Stack Developer</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Full Stack Development, System Architecture, Security Implementation, and UI/UX Design
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

        {/* CTA */}
        <div className="text-center mt-12">
          <Button
            size="lg"
            className="gap-2 abrn-btn-primary"
            onClick={() => window.open("https://github.com/Pranay0205/VaultDrive", "_blank")}
          >
            <Github className="w-5 h-5" />
            View Source Code
          </Button>
        </div>
      </div>
    </div>
  );
}
