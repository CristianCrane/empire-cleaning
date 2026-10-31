import { useId, type ReactNode } from "react";
import { Heading } from "./Heading.tsx";
import { twMerge } from "./utils.ts";

export type SectionProps = {
  title: string;
  // the title's place in the page outline: 2 under the page's h1, 3 inside a section
  headingLevel?: 2 | 3 | 4;
  description?: ReactNode;
  // header actions, e.g. a link to the full Schedule
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

// a titled part of a page that sits on the page itself. Use it around a
// List or Table, which draw their own box; a Card around them reads as a
// box in a box
export function Section({
  title,
  headingLevel = 2,
  description,
  actions,
  children,
  className,
}: SectionProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={twMerge("flex flex-col gap-3", className)}
    >
      <header className="flex flex-wrap items-start gap-3">
        {/* wide enough for a title on one line: past that, the actions
            wrap under it rather than squeezing it */}
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Heading level={headingLevel} size={3} id={headingId}>
            {title}
          </Heading>
          {description && (
            <p className="text-sm text-fg-muted [overflow-wrap:anywhere]">
              {description}
            </p>
          )}
        </div>
        {actions && (
          // on the title's line, as tall as it: a Button there never pushes
          // the content down
          <div className="flex h-7 shrink-0 items-center gap-2">{actions}</div>
        )}
      </header>
      {children}
    </section>
  );
}
