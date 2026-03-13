import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Shield, Users, Target, Github } from "lucide-react";
import { Button } from "../components/ui/button";
import VaultIcon from "../components/ui/vault-icon";

export default function About() {
  return (
    <div className="min-h-screen py-16">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-4">
            <VaultIcon className="w-20 h-20 drop-shadow-xl" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            About VaultDrive
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A secure file storage solution built as a college project
            demonstrating modern web development practices
          </p>
        </div>

        {/* Project Motivation */}
        <Card className="mb-12">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Project Motivation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
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
              <li>
                Secure authentication using JWT tokens and bcrypt password
                hashing
              </li>
              <li>
                RESTful API design with proper error handling and validation
              </li>
              <li>Database management with type-safe queries using SQLC</li>
              <li>Modern frontend development with React and TypeScript</li>
              <li>
                Responsive UI design with Tailwind CSS and shadcn/ui components
              </li>
            </ul>
            <p>
              This project serves as a comprehensive learning experience,
              covering the full stack of web development—from database design
              and backend API development to frontend user interface and user
              experience design.
            </p>
          </CardContent>
        </Card>

        {/* Team Section */}
        <Card className="mb-12">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#7d4f50]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#7d4f50]" />
              </div>
              <CardTitle>Development Team</CardTitle>
            </div>
            <CardDescription>Computer Science Students • 2025</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Team Member 1 */}
              <div className="p-6 rounded-lg border bg-card">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">PG</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Pranay Ghuge</h3>
                    <p className="text-sm text-muted-foreground">
                      Full Stack Developer
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Full Stack Development, System Architecture, Security
                  Implementation, and UI/UX Design
                </p>
              </div>

              {/* Team Member 2 */}
              <div className="p-6 rounded-lg border bg-card">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-[#7d4f50]/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-[#7d4f50]">AD</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Arundhati Das</h3>
                    <p className="text-sm text-muted-foreground">
                      Full Stack Developer
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Full Stack Development, System Architecture, Security
                  Implementation, and UI/UX Design
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tech Stack */}
        <Card className="mb-12">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-500" />
              </div>
              <CardTitle>Technology Stack</CardTitle>
            </div>
            <CardDescription>
              Built with modern, industry-standard technologies
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Features Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Key Features</CardTitle>
            <CardDescription>
              What makes VaultDrive secure and user-friendly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                <div>
                  <h4 className="font-semibold mb-1">Secure Authentication</h4>
                  <p className="text-sm text-muted-foreground">
                    JWT-based authentication with refresh tokens and bcrypt
                    password hashing
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                <div>
                  <h4 className="font-semibold mb-1">File Management</h4>
                  <p className="text-sm text-muted-foreground">
                    Upload, download, and manage files with metadata tracking
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                <div>
                  <h4 className="font-semibold mb-1">User Dashboard</h4>
                  <p className="text-sm text-muted-foreground">
                    Intuitive interface for managing your files and account
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                <div>
                  <h4 className="font-semibold mb-1">Theme Support</h4>
                  <p className="text-sm text-muted-foreground">
                    Dark and light mode with persistent user preference
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center mt-12">
          <Button
            size="lg"
            className="gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white"
            onClick={() =>
              window.open("https://github.com/Pranay0205/VaultDrive", "_blank")
            }
          >
            <Github className="w-5 h-5" />
            View Source Code
          </Button>
        </div>

        {/* Attribution */}
        <div className="text-center mt-12 text-xs text-muted-foreground"></div>
      </div>
    </div>
  );
}
