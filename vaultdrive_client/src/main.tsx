import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ThemeProvider } from "./components/theme-provider";
import { SWRConfig } from "swr";
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


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultSkin="quantix" storageKey="quantixdrive-skin">
      <SWRConfig value={{ fetcher, keepPreviousData: true, errorRetryCount: 1 }}>
        <App />
      </SWRConfig>
    </ThemeProvider>
  </StrictMode>
);
