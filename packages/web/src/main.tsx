import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { applyThemePreference, readThemePreference } from "@empire-cleaning/ui";
import {
  routerTracing,
  startMonitoring,
} from "@empire-cleaning/browser-monitoring";
import { feedbackButton } from "@empire-cleaning/browser-monitoring/feedback";
import feedbackLook from "./feedback.css?inline";
import { router } from "./router.tsx";
import { forgetAccount } from "./session.ts";

// Sentry (ADR-0007), set at build time: without VITE_SENTRY_DSN (dev, tests)
// nothing is sent. The test site's pages carry its feedback button
// (ADR-0020); no other build has it, as the mode is known at build time and
// the button's code and look are dropped with the branch that isn't taken
const mode = import.meta.env.VITE_APP_MODE ?? "dev";
startMonitoring({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: mode,
  tracing: routerTracing(router),
  feedback: mode === "test" ? feedbackButton(feedbackLook) : undefined,
});

applyThemePreference(readThemePreference());

// Who the person is and what their Account is connected to can change behind
// the app's back: another tab signing out, asking for a Quote on the landing
// page, the Office adding a record. So look again whenever they come back to
// the tab, rather than on every click.
let lastLook = 0;
const lookAgain = () => {
  if (document.visibilityState !== "visible") return;
  // switching tabs fires more than one of these
  if (Date.now() - lastLook < 1000) return;
  lastLook = Date.now();
  forgetAccount();
  void router.invalidate();
};
window.addEventListener("focus", lookAgain);
document.addEventListener("visibilitychange", lookAgain);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
