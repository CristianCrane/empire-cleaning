import look from "@empire-cleaning/ui/feedback.css?inline";
import { feedbackButton as button } from "@empire-cleaning/browser-monitoring/feedback";

// the test site's feedback button (ADR-0020) in the design system's look,
// bottom right: nothing else on these pages is fixed. Imported by the start of
// Sentry (monitoring.ts) only on the test site, so no other build carries it
export const feedbackButton = () => button(look);
