import { useEffect, useState, type ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "../Breadcrumbs.tsx";
import { Heading } from "../Heading.tsx";
import { useWide } from "../wide.ts";
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
// drops under the title before the button moves. From md, once the window's
// top reaches the title row's actions, a slim header sticks at the top with
// the title, the badge and the same actions (docs/ux.md, Page structure);
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
      primary?: never;
    }
  | {
      actions?: never;
      next?: never;
      // a List's one primary, filled: making a new one
      primary?: PageAction;
    }
)) {
  const [row, scrolledAway] = useScrolledAway();
  // the header that sticks is a wider screen's: on a phone the title row's
  // stays where it is, the next step at the foot
  const wide = useWide();
  const away = scrolledAway && wide;
  const more = actions.filter((a) => !!a);
  // the page's action control: its next step and the rest, or the rest
  // alone; drawn on the title row, and in the header that sticks once that
  // has scrolled away (a List's primary stays on its row)
  const control = next ? (
    <SplitButton next={next} more={more} opens="menu" />
  ) : !primary && more.length > 0 ? (
    <RareActions actions={more} />
  ) : null;
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
        {control && (
          // scrolled away, the header that sticks holds it, and on a phone
          // the layout's foot holds a next step: one copy at a time is
          // there to press
          <div
            ref={row}
            inert={away}
            aria-hidden={away}
            className={`shrink-0 print:hidden ${next ? "max-md:hidden" : ""}`}
          >
            {control}
          </div>
        )}
      </div>
      {control && (
        <StickyHeader shown={away} title={title} status={status}>
          {control}
        </StickyHeader>
      )}
    </header>
  );
}

// From md, the slim header that slides in at the top once the window's top
// reaches the title row's actions, lined up with the page's column: the
// title, its badge, and at its end what's given (the same actions).
// Out of sight it's out of reach too, so one copy of the button is there to
// press at a time; and its title and badge go once it has slid out, so the
// page says them once (its actions stay, as a dialog they opened is theirs)
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
  const [leaving, setLeaving] = useState(false);
  const [wasShown, setWasShown] = useState(shown);
  if (wasShown !== shown) {
    setWasShown(shown);
    setLeaving(!shown);
  }
  const named = shown || leaving;
  return (
    <div
      inert={!shown}
      aria-hidden={!shown}
      // its own slide, not a button's colour inside it
      onTransitionEnd={(event) =>
        event.target === event.currentTarget && setLeaving(false)
      }
      className={`pointer-events-none fixed inset-x-0 top-0 z-30 hidden transition-[translate,opacity,visibility] duration-200 left-side md:block print:hidden ${
        shown
          ? "translate-y-0 opacity-100"
          : "invisible -translate-y-full opacity-0"
      }`}
    >
      <div className="page-column">
        <div className="pointer-events-auto flex items-center gap-3 rounded-b-lg border-x border-b border-border bg-surface px-4 py-2 shadow-raised">
          {named && (
            <>
              <p className="min-w-0 truncate font-display text-xl font-bold tracking-wide uppercase">
                {title}
              </p>
              {status}
            </>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// whether the element has scrolled up past the window's top, even in part
// (so the reader never meets half a button), and not merely hidden, as a
// next step on the title row is on a phone. Given by its ref, so it watches
// the element from whenever it's drawn
function useScrolledAway() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (!element) return setAway(false);
    const watch = new IntersectionObserver(
      ([entry]) =>
        setAway(
          !!entry &&
            entry.intersectionRatio < 1 &&
            entry.boundingClientRect.height > 0 &&
            entry.boundingClientRect.top < 0,
        ),
      { threshold: 1 },
    );
    watch.observe(element);
    return () => watch.disconnect();
  }, [element]);
  return [setElement, away] as const;
}
