import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";
import { ABRNLogo } from "./branding";
import { Shield } from "lucide-react";

interface NavbarProps {
  children: React.ReactNode;
}

export default function Navbar({ children }: NavbarProps) {
  const navigate = useNavigate();

  // Initialize state from localStorage
  const getInitialAuthState = () => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (token && userData) {
      return {
        isLoggedIn: true,
        user: JSON.parse(userData) as { username: string; email: string; is_admin?: boolean },
      };
    }
    return { isLoggedIn: false, user: null };
  };

  const [isLoggedIn, setIsLoggedIn] = useState(
    getInitialAuthState().isLoggedIn
  );
  const [user, setUser] = useState<{ username: string; email: string; is_admin?: boolean } | null>(
    getInitialAuthState().user
  );

  // Listen for storage changes (for cross-tab sync) and custom auth events
  useEffect(() => {
    const handleStorageChange = () => {
      const authState = getInitialAuthState();
      setIsLoggedIn(authState.isLoggedIn);
      setUser(authState.user);
    };

    const handleAuthChange = () => {
      const authState = getInitialAuthState();
      setIsLoggedIn(authState.isLoggedIn);
      setUser(authState.user);
    };

    // Listen for storage events (cross-tab)
    window.addEventListener("storage", handleStorageChange);

    // Listen for custom auth change event (same tab)
    window.addEventListener("auth-change", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("auth-change", handleAuthChange);
    };
  }, []);

  const handleLogin = () => {
    navigate("/login");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    setUser(null);

    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event("auth-change"));

    navigate("/");
  };

const getInitials = (name: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <>
      <nav className="abrn-glass-nav sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <ABRNLogo className="w-10 h-10 m-1" />
              <h1 className="text-2xl font-bold text-primary">ABRN Drive</h1>
            </div>
            <ul className="flex gap-6">
              <li>
                <Link to="/" className="text-foreground/85 hover:text-primary transition-colors font-medium text-sm">
                  Home
                </Link>
              </li>
              {isLoggedIn && (
                <>
                  <li>
                    <Link
                      to="/files"
                      className="text-foreground/85 hover:text-primary transition-colors font-medium text-sm"
                    >
                      Files
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/shared"
                      className="text-foreground/85 hover:text-primary transition-colors font-medium text-sm"
                    >
                      Shared
                    </Link>
                  </li>
                  {user?.is_admin && (
                    <li>
                      <Link
                        to="/admin"
                        className="text-foreground/85 hover:text-primary transition-colors font-medium text-sm flex items-center gap-1"
                      >
                        <Shield className="h-4 w-4" />
                        Admin
                      </Link>
                    </li>
                  )}
                </>
              )}
              <li>
                <Link
                  to="/about"
                  className="text-foreground/85 hover:text-primary transition-colors font-medium text-sm"
                >
                  About
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            {isLoggedIn && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <span className="text-sm font-medium text-foreground">
                      Hi, {user.username}
                    </span>
                    <Avatar>
                      <AvatarImage src="" alt={user.username} />
                      <AvatarFallback>
                        {getInitials(user.username)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/files")}>
                    My Files
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/shared")}>
                    Shared With Me
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={handleLogin}>Login</Button>
            )}
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </>
  );
}
