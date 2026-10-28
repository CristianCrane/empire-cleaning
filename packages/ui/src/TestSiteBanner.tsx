import { FlaskConical } from "lucide-react";

// across the top of every page on the test site (ADR-0020), so nobody takes
// it for the real one
export function TestSiteBanner() {
  return (
    <p className="flex print:hidden items-center justify-center gap-2 bg-warning-subtle px-4 py-1.5 text-center text-sm font-semibold text-warning-strong">
      <FlaskConical aria-hidden size={16} className="shrink-0" />
      Test site: no real payments or cleans
    </p>
  );
}
