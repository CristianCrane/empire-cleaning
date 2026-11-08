import theme from "@empire-cleaning/ui/feedback.css?inline";

// the test site's feedback button (ADR-0020), imported by the start of Sentry
// (monitoring.ts) only on the test site, so no other build carries its code or
// its look. The look is added as the button starts, not imported as a
// stylesheet: Astro would put that on every page of every build
export const feedbackButton = async () => {
  const style = document.createElement("style");
  style.textContent = theme;
  document.head.append(style);
  const { feedbackButton } =
    await import("@empire-cleaning/browser-monitoring/feedback");
  return feedbackButton();
};
