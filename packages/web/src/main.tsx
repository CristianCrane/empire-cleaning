import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { applyThemePreference, readThemePreference } from "@empire-cleaning/ui";
import { router } from "./router.tsx";
import { forgetAccount } from "./session.ts";

applyThemePreference(readThemePreference());

// Who the person is and what their Account is connected to can change behind
// the app's back: another tab signing out, a Quote Request from the landing
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
