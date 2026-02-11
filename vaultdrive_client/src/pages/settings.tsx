import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  Shield,
  User,
  Mail,
  Calendar,
  HardDrive,
  Lock,
  Key,
  Sun,
  Moon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../components/theme-provider";
import { DashboardLayout } from "../components/layout/dashboard-layout";

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [userData] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    if (!token || !userData) {
      navigate("/login");
    }
  }, [userData, navigate]);

  if (!userData) {
    return null; // Will redirect to login
  }

  return (
    <DashboardLayout>
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account preferences and settings
          </p>
        </div>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {theme === "dark" ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
              Appearance
            </CardTitle>
<CardDescription>
              Customize your workspace preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose between light and dark mode
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4" />
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? "dark" : "light")
                  }
                />
                <Moon className="w-4 h-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Account Information
            </CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Username
                  </Label>
                  <p className="font-medium">{userData.username}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <p className="font-medium">{userData.email}</p>
                </div>
              </div>
              {userData.created_at && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Member Since
                  </Label>
                  <p className="font-medium">
                    {new Date(userData.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
            </CardTitle>
            <CardDescription>
              Your data is protected with end-to-end encryption
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <Lock className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    End-to-End Encryption Enabled
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    All your files are encrypted with AES-256-GCM before upload
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Key className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    RSA-2048 Key Pair
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Your encryption keys are secured with password-based
                    derivation (PBKDF2)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Security Features</Label>
                <ul className="text-sm space-y-2 ml-4">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    JWT-based authentication with refresh tokens
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Bcrypt password hashing
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Secure file sharing with public key cryptography
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Server never sees unencrypted files
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Storage Info (Placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Storage
            </CardTitle>
            <CardDescription>Your file storage information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Storage Used</span>
                  <span className="font-medium">View Files page for details</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload encrypted files to start using your secure vault
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </DashboardLayout>
  );
}
