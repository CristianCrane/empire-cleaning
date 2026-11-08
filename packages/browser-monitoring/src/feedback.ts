import * as Sentry from "@sentry/react";

// Sentry's feedback button, for `startMonitoring`'s `feedback` on the test
// sites (ADR-0020): a floating button opening a form, what they noticed and a
// screenshot if they like. They're known by the Account ID alone, so no name
// or email is asked. Each site places it, and @empire-cleaning/ui/feedback.css
// colours it. Its own entry, which the rest of this package never imports, so
// a build that doesn't import it carries none of its code, even one that
// loads the package with import()
export const feedbackButton = () =>
  Sentry.feedbackIntegration({
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
