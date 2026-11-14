import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// What most don't need to read, folded under a line saying what it is
// ("How it's worked out", "What was asked"): a tap opens it. Open to start
// with when it's what the reader is there for (what was asked, while the
// Quote is written from it)
export function Fold({
  label,
  defaultOpen = false,
  children,
}: {
  label: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group flex flex-col" open={defaultOpen}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-sm font-semibold text-primary outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden
          size={16}
          className="shrink-0 transition-transform group-open:rotate-180"
        />
        {label}
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}
