import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  ToastRegion,
  applyThemePreference,
  readThemePreference,
} from "@empire-cleaning/ui";
import { App } from "./App.tsx";

applyThemePreference(readThemePreference());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <ToastRegion />
  </StrictMode>,
);
