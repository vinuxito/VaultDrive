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
import Email from "./pages/email";
import Admin from "./pages/admin";
import AdminTests from "./pages/admin-tests";
import DropUpload from "./pages/drop-upload";
import { ProtectedRoute } from "./components/protected-route";

function App() {
  return (
    <Router basename="/abrn">
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Public pages with Navbar */}
        <Route path="/" element={<Navbar><Home /></Navbar>} />
        <Route path="/about" element={<Navbar><About /></Navbar>} />
        <Route path="/drop/:token" element={<DropUpload />} />
        {/* Authenticated pages - ProtectedRoute handles auth check + DashboardLayout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/files" element={<Files />} />
          <Route path="/shared" element={<Shared />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/groups/:id" element={<Groups />} />
          <Route path="/email" element={<Email />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/tests" element={<AdminTests />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
// 20260204-170831
