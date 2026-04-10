import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router-dom";
import Navbar from "./components/navbar";
import Home from "./pages/home";
import Login from "./pages/login";
import About from "./pages/about";
import DropUpload from "./pages/drop-upload";
import PublicSharePage from "./pages/PublicSharePage";
import PublicFolderSharePage from "./pages/PublicFolderSharePage";
import FileRequestPage from "./pages/FileRequestPage";
import ForcePasswordChange from "./pages/force-password-change";
import { ProtectedRoute } from "./components/protected-route";
import { SessionVaultProvider } from "./context/SessionVaultContext";
import { BASE_PATH } from "./utils/base-path";

// Heavy authenticated pages — code-split to reduce initial bundle size.
const Dashboard = lazy(() => import("./pages/dashboard"));
const Files = lazy(() => import("./pages/files"));
const Shared = lazy(() => import("./pages/shared"));
const Profile = lazy(() => import("./pages/profile"));
const Settings = lazy(() => import("./pages/settings"));
const Groups = lazy(() => import("./pages/groups"));
const Admin = lazy(() => import("./pages/admin"));
const AdminTests = lazy(() => import("./pages/admin-tests"));
const AccessCenter = lazy(() => import("./pages/access-center"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const basename = BASE_PATH;

function App() {
  return (
    <SessionVaultProvider>
      <Router basename={basename}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/force-password-change" element={<ForcePasswordChange />} />
          {/* Public pages with Navbar */}
          <Route path="/" element={<Navbar><Home /></Navbar>} />
          <Route path="/about" element={<Navbar><About /></Navbar>} />
          <Route path="/drop/:token" element={<DropUpload />} />
          <Route path="/share/:token" element={<PublicSharePage />} />
          <Route path="/folder-share/:token" element={<PublicFolderSharePage />} />
          <Route path="/request/:token" element={<FileRequestPage />} />
          {/* Authenticated pages - ProtectedRoute handles auth check + DashboardLayout */}
          <Route element={<ProtectedRoute />}>
            {/* Suspense layout: wraps Outlet so lazy chunks show a spinner */}
            <Route element={<Suspense fallback={<PageLoader />}><Outlet /></Suspense>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/files" element={<Files />} />
              <Route path="/shared" element={<Shared />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/groups/:id" element={<Groups />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/tests" element={<AdminTests />} />
              <Route path="/access-center" element={<AccessCenter />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </SessionVaultProvider>
  );
}

export default App;
// 20260204-170831
