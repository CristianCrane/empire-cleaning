import { useId, type ReactNode } from "react";
import { Heading } from "./Heading.tsx";
import { twMerge } from "./utils.ts";

export type CardProps = {
  title?: string;
  // the title's place in the page outline: 2 under the page's h1, 3 inside a section
  headingLevel?: 2 | 3 | 4;
  description?: ReactNode;
  // header actions, e.g. an Edit button
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function Card({
  title,
  headingLevel = 2,
  description,
  actions,
  children,
  className,
}: CardProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={twMerge(
        "flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 text-fg shadow-raised sm:p-5 print:break-inside-avoid print:shadow-none",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {title && (
              <Heading level={headingLevel} size={3} id={headingId}>
                {title}
              </Heading>
            )}
            {description && (
              <p className="text-sm text-fg-muted">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
