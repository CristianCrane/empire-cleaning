import type { ReactNode } from "react";
import { ActionFooter } from "../ActionFooter.tsx";
import type { Crumb } from "../Breadcrumbs.tsx";
import { Card } from "../Card.tsx";
import { useUiWords } from "../language.ts";
import { Section } from "../Section.tsx";
import { Alerts, type Alert } from "./Alerts.tsx";
import { PageHeader, type PageActions } from "./PageHeader.tsx";

// The Record type's layout (docs/ux.md, Screen types, Record; #432): a page
// about one thing. Its PageHeader; its alerts, most pressing first, two of
// them and the rest behind "Show N more"; its DetailsCard; each part of it,
// a Section; and its History in a Card, on the right from `xl` and at the
// foot below that. A bar at the foot holds only what must stay in reach on
// site (a Cleaner's Complete): every other action is in the header, or on
// the part it acts on
export function RecordPage({
  trail,
  title,
  status,
  subtitle,
  actions,
  alerts = [],
  details,
  history,
  footer,
  children,
}: {
  trail: Crumb[];
  title: string;
  status?: ReactNode;
  subtitle?: ReactNode;
  actions?: PageActions;
  // those that apply now, the rest false, null or undefined
  alerts?: (Alert | false | null | undefined)[];
  // its DetailsCard
  details?: ReactNode;
  // its Timeline, newest first
  history?: ReactNode;
  // the on-site main action, kept in reach in an ActionFooter named `label`
  footer?: { label: string; children: ReactNode };
  // its parts, each a Section
  children?: ReactNode;
}) {
  const words = useUiWords();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        trail={trail}
        title={title}
        status={status}
        subtitle={subtitle}
        actions={actions}
      />
      <Alerts alerts={alerts} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {details}
          {children}
        </div>
        {history && (
          <Section title={words.history}>
            <Card>{history}</Card>
          </Section>
        )}
      </div>
      {footer && (
        <ActionFooter aria-label={footer.label}>{footer.children}</ActionFooter>
      )}
    </div>
  );
}

// A Record's details card, a region named `label` ("Job details"): what
// it is, large, led by its tile (a DateTile for when, an IconTile for what,
// an Avatar for who), a kicker above and a line below; then its Facts, and
// anything else about it, ruled off. A record that's only its facts (a
// Client's contact details) has no lead
export function DetailsCard({
  label,
  tile,
  kicker,
  title,
  line,
  children,
}: {
  label: string;
  tile?: ReactNode;
  kicker?: ReactNode;
  title?: ReactNode;
  line?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card hiddenTitle={label}>
      {title && (
        <div className="flex items-center gap-4">
          {tile}
          <div className="flex min-w-0 flex-col gap-1">
            {kicker && <p className="text-sm text-fg-muted">{kicker}</p>}
            <p className="text-xl font-semibold text-fg [overflow-wrap:anywhere]">
              {title}
            </p>
            {line && <p className="text-fg-muted">{line}</p>}
          </div>
        </div>
      )}
      {title
        ? children && (
            <div className="flex flex-col gap-4 border-t border-border pt-4">
              {children}
            </div>
          )
        : children}
    </Card>
  );
}
