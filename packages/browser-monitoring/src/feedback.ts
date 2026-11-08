import * as Sentry from "@sentry/react";

// Sentry's feedback button, for `startMonitoring`'s `feedback` on the test
// sites (ADR-0020): a floating button opening a form, what they noticed and a
// screenshot if they like. They're known by the Account ID alone, so no name
// or email is asked. Its own entry, which the rest of this package never
// imports, so a build that doesn't import it carries none of its code, even
// one that loads the package with import().
//
// `look` is the site's CSS for it, as text (`import look from "…css?inline"`):
// @empire-cleaning/ui/feedback.css and where the site places it. It goes into
// the page before the button does, so the button never shows without it, and
// as text, so a build without the button carries none of it either (a
// stylesheet import would be in every build's CSS)
export const feedbackButton = (look: string) => {
  const style = document.createElement("style");
  style.textContent = look;
  document.head.append(style);
  return Sentry.feedbackIntegration({
    showBranding: false,
    showName: false,
    showEmail: false,
    enableScreenshot: true,
    triggerLabel: "Send feedback",
    formTitle: "Send feedback",
    messageLabel: "What did you notice?",
    messagePlaceholder: "Something that's wrong, or that you'd change",
    submitButtonLabel: "Send",
    successMessageText: "Thanks! We got it.",
  });
};
