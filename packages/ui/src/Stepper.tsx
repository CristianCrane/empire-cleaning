import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button.tsx";

/**
 * Back and forward through a calendar's pages: a quiet arrow each side of
 * what goes between them (the Schedule's Today), then the page shown, read
 * out as it changes. The Schedule's days, a Cleaner's months of working
 * hours, a Draft quote's week of open times. Back is off where there's
 * nothing earlier to show (`canGoBack`).
 */
export function Stepper({
  label,
  previous,
  next,
  canGoBack = true,
  onStep,
  children,
}: {
  // the page shown: "Jan 5 – Jan 11", "January 2026"
  label: ReactNode;
  // each arrow's name: "Previous week", "Next month"
  previous: string;
  next: string;
  canGoBack?: boolean;
  onStep: (by: -1 | 1) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="quiet"
        size="icon"
        aria-label={previous}
        isDisabled={!canGoBack}
        onPress={() => onStep(-1)}
      >
        <ChevronLeft aria-hidden size={20} />
      </Button>
      {children}
      <Button
        variant="quiet"
        size="icon"
        aria-label={next}
        onPress={() => onStep(1)}
      >
        <ChevronRight aria-hidden size={20} />
      </Button>
      <p className="font-semibold text-fg" aria-live="polite">
        {label}
      </p>
    </div>
  );
}
