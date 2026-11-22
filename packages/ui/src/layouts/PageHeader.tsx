import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "../Breadcrumbs.tsx";
import { Heading } from "../Heading.tsx";
import {
  ActionButton,
  HeaderActions,
  type PageAction,
  type PageActions,
} from "./PageActions.tsx";

// The page header every screen type that has one shares (docs/ux.md,
// Screen types): the breadcrumbs from the area's nav section down to this
// page, every step, or none on a nav section's own page (a List); the
// title and its status; a subtitle only when it says what nothing else on
// the page does, never the title or a crumb again; and the page's actions
// in one place at the end of the title row, or a List's one primary there
// (New …). Printed, it's the title alone. A layout places it, never a
// screen (ADR-0031)
export function PageHeader({
  trail,
  title,
  inBar = false,
  status,
  subtitle,
  actions = [],
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
  actions?: PageActions;
  // a List's one primary, filled: making a new one
  primary?: PageAction;
  // what else the layout keeps on the title row, before the actions (a
  // phone's search icon)
  tools?: ReactNode;
}) {
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
    !actions.some((a) => !!a);
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
            <Heading level={1} inBar={inBar}>
              {title}
            </Heading>
            {status}
          </div>
          {subtitle && <p className="text-lg text-fg-muted">{subtitle}</p>}
        </div>
        {tools && <div className="shrink-0 print:hidden">{tools}</div>}
        {primary ? (
          <div className="shrink-0 print:hidden">
            <ActionButton action={primary} variant="primary" />
          </div>
        ) : (
          <HeaderActions actions={actions.filter((a) => !!a)} />
        )}
      </div>
    </header>
  );
}
