import { useEffect, useState, type ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "../Breadcrumbs.tsx";
import { Heading } from "../Heading.tsx";
import {
  ActionButton,
  RareActions,
  SplitButton,
  type PageAction,
  type PageActions,
} from "./PageActions.tsx";

// The page header every screen type that has one shares (docs/ux.md,
// Screen types): the breadcrumbs from the area's nav section down to this
// page, every step, or none on a nav section's own page (a List); the
// title and its status; a subtitle only when it says what nothing else on
// the page does, never the title or a crumb again; and at the end of the
// title row, on the title's line, the page's actions: its next step as a
// split button, the rest behind its arrow; with nothing next, the rest as
// RareActions; or a List's one primary (New …). Short of room, the badge
// drops under the title before the button moves. From md, once the title
// row's split button scrolls away, a slim header sticks at the top with the
// title, the badge and the same split button (docs/ux.md, Page structure);
// on a phone the layout pins the next step at the foot (RecordPage), so the
// title row's is hidden there. Printed, it's the title alone. A layout
// places it, never a screen (ADR-0031)
export function PageHeader({
  trail,
  title,
  inBar = false,
  status,
  subtitle,
  actions = [],
  next,
  summary,
  primary,
  tools,
}: {
  // from the area's nav section to this page, which is last; none on the
  // section's own page
  trail?: Crumb[];
  title: string;
  // a nav section's own page, which a phone's top bar already names: the
  // title hidden there (Heading's inBar)
  inBar?: boolean;
  // its StatusBadge, or two
  status?: ReactNode;
  subtitle?: ReactNode;
  // what else the layout keeps on the title row, before the actions (a
  // phone's search icon)
  tools?: ReactNode;
} & (
  | {
      // what the page can do besides its next step
      actions?: PageActions;
      // the page's next step, its primary
      next?: PageAction;
      // what the header that sticks keeps beside the next step, as it's
      // what the step rests on (a Draft's price)
      summary?: ReactNode;
      primary?: never;
    }
  | {
      actions?: never;
      next?: never;
      summary?: never;
      // a List's one primary, filled: making a new one
      primary?: PageAction;
    }
)) {
  const [row, away] = useScrolledAway();
  const more = actions.filter((a) => !!a);
  // a phone's bar already says the title, and it's all there is: the header
  // is hidden there with it, so it takes no room of its own, not even the
  // gap its layout leaves between parts (the Schedule, Offers, Your details)
  const titleAlone =
    inBar &&
    !trail &&
    !status &&
    !subtitle &&
    !tools &&
    !primary &&
    !next &&
    more.length === 0;
  return (
    <header
      className={`flex flex-col gap-4 ${titleAlone ? "max-md:sr-only" : ""}`}
    >
      {trail && (
        <div className="print:hidden">
          <Breadcrumbs trail={trail} />
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* the title's line as tall as the button at its end, so the
                button sits on it */}
            <Heading
              level={1}
              inBar={inBar}
              className="flex min-h-touch items-center"
            >
              {title}
            </Heading>
            {status}
          </div>
          {subtitle && <p className="text-lg text-fg-muted">{subtitle}</p>}
        </div>
        {tools && <div className="shrink-0 print:hidden">{tools}</div>}
        {primary && (
          <div className="shrink-0 print:hidden">
            <ActionButton action={primary} variant="primary" />
          </div>
        )}
        {next && (
          // on a phone the layout's foot holds it; scrolled away, the
          // header that sticks does: one copy at a time is there to press
          <div
            ref={row}
            inert={away}
            aria-hidden={away}
            className="shrink-0 max-md:hidden print:hidden"
          >
            <SplitButton next={next} more={more} opens="menu" />
          </div>
        )}
        {!primary && !next && more.length > 0 && (
          <div className="shrink-0 print:hidden">
            <RareActions actions={more} />
          </div>
        )}
      </div>
      {next && (
        <StickyHeader shown={away} title={title} status={status}>
          {summary}
          <SplitButton next={next} more={more} opens="menu" />
        </StickyHeader>
      )}
    </header>
  );
}

// From md, the slim header that slides in at the top once the title row's
// split button has scrolled away, lined up with the page's column: the
// title, its badge, and at its end what's given (the same split button).
// Out of sight it's out of reach too, so one copy of the button is there to
// press at a time
function StickyHeader({
  shown,
  title,
  status,
  children,
}: {
  shown: boolean;
  title: string;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      inert={!shown}
      aria-hidden={!shown}
      className={`pointer-events-none fixed inset-x-0 top-0 z-30 hidden transition-[translate,opacity,visibility] duration-200 left-side md:block print:hidden ${
        shown
          ? "translate-y-0 opacity-100"
          : "invisible -translate-y-full opacity-0"
      }`}
    >
      <div className="page-column">
        <div className="pointer-events-auto flex items-center gap-3 rounded-b-lg border-x border-b border-border bg-surface px-4 py-2 shadow-raised">
          <p className="min-w-0 truncate font-display text-xl font-bold tracking-wide uppercase">
            {title}
          </p>
          {status}
          <div className="ml-auto flex shrink-0 items-center gap-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// whether the element has scrolled up out of view, and not merely hidden,
// as the title row's split button is on a phone. Given by its ref, so it
// watches the element from whenever it's drawn
function useScrolledAway() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (!element) return setAway(false);
    const watch = new IntersectionObserver(([entry]) =>
      setAway(
        !!entry &&
          !entry.isIntersecting &&
          entry.boundingClientRect.height > 0 &&
          entry.boundingClientRect.bottom < 1,
      ),
    );
    watch.observe(element);
    return () => watch.disconnect();
  }, [element]);
  return [setElement, away] as const;
}
