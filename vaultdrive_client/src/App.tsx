import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/navbar";
import Home from "./pages/home";
import Login from "./pages/login";
import Files from "./pages/files";
import Shared from "./pages/shared";
import About from "./pages/about";
import Profile from "./pages/profile";
import Settings from "./pages/settings";
import Groups from "./pages/groups";
import Admin from "./pages/admin";
import AdminTests from "./pages/admin-tests";
import DropUpload from "./pages/drop-upload";
import PublicSharePage from "./pages/PublicSharePage";
import FileRequestPage from "./pages/FileRequestPage";
import Dashboard from "./pages/dashboard";
import { ProtectedRoute } from "./components/protected-route";
import { SessionVaultProvider } from "./context/SessionVaultContext";

const basename = window.location.hostname === "abrndrive.filemonprime.net" ? "/" : "/abrn";

function App() {
  return (
    <SessionVaultProvider>
      <Router basename={basename}>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Public pages with Navbar */}
          <Route path="/" element={<Navbar><Home /></Navbar>} />
          <Route path="/about" element={<Navbar><About /></Navbar>} />
          <Route path="/drop/:token" element={<DropUpload />} />
          <Route path="/share/:token" element={<PublicSharePage />} />
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
          </Route>
        </Routes>
      </Router>
    </SessionVaultProvider>
  );
}

export default App;
// 20260204-170831
