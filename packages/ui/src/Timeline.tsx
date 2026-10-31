import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { LinkProps } from "react-aria-components";
import { Link } from "./Link.tsx";
import { twMerge } from "./utils.ts";

// Something's story, newest first: what's happening now on top (in the
// brand colour, holding the work in hand), then each thing that happened,
// dated. For a record that moves through steps over time, like a Quote.
export function Timeline({
  children,
  className,
  ...props
}: {
  "aria-label": string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ol {...props} className={twMerge("flex flex-col", className)}>
      {children}
    </ol>
  );
}

export function TimelineItem({
  icon: Icon,
  title,
  href,
  when,
  description,
  current = false,
  children,
}: {
  // decorative: the title carries the meaning
  icon: LucideIcon;
  title: string;
  // its own page, if it has one: the title opens it, reading as a title
  // until it's hovered
  href?: LinkProps["href"];
  // when it happened, e.g. "Oct 8, 2026"; none on what's happening now
  when?: string;
  description?: ReactNode;
  // what's happening now: the first item
  current?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-x-3 [&:last-child_[data-line]]:hidden">
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className={twMerge(
            "flex size-8 shrink-0 items-center justify-center rounded-full sm:size-10",
            current
              ? "bg-primary text-primary-fg"
              : "border border-border bg-surface text-fg-muted",
          )}
        >
          <Icon size={16} />
        </span>
        <span data-line aria-hidden className="w-px flex-1 bg-border" />
      </div>
      <div className="flex min-w-0 flex-col gap-3 pt-1 pb-8 sm:pt-2">
        <div className="flex flex-col gap-0.5">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">
              {href ? (
                <Link
                  href={href}
                  className="font-semibold text-fg no-underline hover:underline"
                >
                  {title}
                </Link>
              ) : (
                title
              )}
            </span>
            {when && <span className="text-sm text-fg-muted">{when}</span>}
          </p>
          {description && (
            <div className="text-sm text-fg-muted">{description}</div>
          )}
        </div>
        {children}
      </div>
    </li>
  );
}
