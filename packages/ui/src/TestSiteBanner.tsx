import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { useUiWords } from "./language.ts";

// across the top of every page on the test site (ADR-0020), so nobody takes
// it for the real one. `children` follows the message, e.g. who's signed in
export function TestSiteBanner({ children }: { children?: ReactNode }) {
  return (
    <p className="flex print:hidden flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-warning-subtle px-4 py-1.5 text-center text-sm font-semibold text-warning-strong">
      <span className="flex items-center gap-2">
        <FlaskConical aria-hidden size={16} className="shrink-0" />
        {useUiWords().testSite}
      </span>
      {children}
    </p>
  );
}
