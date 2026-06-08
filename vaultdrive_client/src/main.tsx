import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ThemeProvider } from "./components/theme-provider";
import { SWRConfig } from "swr";
import { ToastProvider } from "./context/ToastContext";
import "./i18n";

const fetcher = (url: string) => {
  const token = localStorage.getItem("token");
  return fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((res) => {
    if (!res.ok) throw new Error("API error");
    return res.json();
  });
};
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const basePath = import.meta.env.VITE_BASE_PATH || "";
    const swUrl = `${basePath.endsWith("/") ? basePath : basePath + "/" }sw.js`;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.error("Service Worker registration failed:", err);
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultSkin="quantix" storageKey="quantixdrive-skin">
      <SWRConfig value={{ fetcher, keepPreviousData: true, errorRetryCount: 1 }}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SWRConfig>
    </ThemeProvider>
  </StrictMode>
);
