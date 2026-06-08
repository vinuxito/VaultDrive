import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/navbar";
import { ProtectedRoute } from "./components/protected-route";
import { SessionVaultProvider } from "./context/SessionVaultContext";
import { BASE_PATH } from "./utils/base-path";
import { CommandPalette } from "./components/ui/command-palette";

// Lazy-loaded routes for both public and private views to shrink initial bundle
const Home = lazy(() => import("./pages/home"));
const Login = lazy(() => import("./pages/login"));
const About = lazy(() => import("./pages/about"));
const DropUpload = lazy(() => import("./pages/drop-upload"));
const PublicSharePage = lazy(() => import("./pages/PublicSharePage"));
const PublicFolderSharePage = lazy(() => import("./pages/PublicFolderSharePage"));
const FileRequestPage = lazy(() => import("./pages/FileRequestPage"));
const ForcePasswordChange = lazy(() => import("./pages/force-password-change"));
const Recover = lazy(() => import("./pages/recover"));

const Dashboard = lazy(() => import("./pages/dashboard"));
const Files = lazy(() => import("./pages/files"));
const Shared = lazy(() => import("./pages/shared"));
const Profile = lazy(() => import("./pages/profile"));
const Settings = lazy(() => import("./pages/settings"));
const Groups = lazy(() => import("./pages/groups"));
const Admin = lazy(() => import("./pages/admin"));
const AdminTests = lazy(() => import("./pages/admin-tests"));
const AccessCenter = lazy(() => import("./pages/access-center"));
const HelpCenter = lazy(() => import("./pages/help"));
const ZKRoom = lazy(() => import("./pages/zk-room"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const basename = BASE_PATH;

function App() {
  return (
    <SessionVaultProvider>
      <Router basename={basename}>
        <CommandPalette />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/force-password-change" element={<ForcePasswordChange />} />
            <Route path="/recover" element={<Recover />} />
            {/* Public pages with Navbar */}
            <Route path="/" element={<Navbar><Home /></Navbar>} />
            <Route path="/about" element={<Navbar><About /></Navbar>} />
            <Route path="/drop/:token" element={<DropUpload />} />
            <Route path="/share/:token" element={<PublicSharePage />} />
            <Route path="/folder-share/:token" element={<PublicFolderSharePage />} />
            <Route path="/request/:token" element={<FileRequestPage />} />
            {/* Authenticated pages - ProtectedRoute handles auth check + DashboardLayout */}
            <Route element={<ProtectedRoute />}>
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
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/room/:roomId" element={<ZKRoom />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </SessionVaultProvider>
  );
}

export default App;
