import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ThemeProvider } from "./components/theme-provider";
import { ToastProvider } from "./context/ToastContext";
import "./i18n";


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultSkin="quantix" storageKey="quantixdrive-skin">
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>
);
