import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ActionFooter } from "../ActionFooter.tsx";
import type { Crumb } from "../Breadcrumbs.tsx";
import { Button } from "../Button.tsx";
import { Card } from "../Card.tsx";
import { useUiWords } from "../language.ts";
import { Notice } from "../Notice.tsx";
import { Section } from "../Section.tsx";
import { PageHeader, type PageActions } from "./PageHeader.tsx";

// what a Record says above itself: a Notice's tone, what it says, and at
// most one text Button for what to do about it
export type Alert = {
  key: string;
  tone?: "info" | "warning" | "success" | "danger";
  children: ReactNode;
  action?: ReactNode;
};

// how many show before "Show N more"
const SHOWN = 2;

// most pressing first: what went wrong, then what's the Office's to do
const order = { danger: 0, warning: 1, info: 2, success: 3 };

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
      <Alerts
        alerts={alerts
          .filter((a) => !!a)
          // a stable sort: each screen's order within a tone
          .sort((a, b) => order[a.tone ?? "info"] - order[b.tone ?? "info"])}
      />
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

// never a wall of them: the first two, the rest a tap away. On screen
// only: what's to do about a record isn't on its printout (a Bill's)
function Alerts({ alerts }: { alerts: Alert[] }) {
  const words = useUiWords();
  const [all, setAll] = useState(false);
  if (alerts.length === 0) return null;
  const hidden = all ? 0 : alerts.length - SHOWN;
  return (
    <div className="flex flex-col gap-3 print:hidden">
      {alerts.slice(0, hidden > 0 ? SHOWN : undefined).map((alert) => (
        <Notice key={alert.key} tone={alert.tone} action={alert.action}>
          {alert.children}
        </Notice>
      ))}
      {hidden > 0 && (
        <Button
          variant="text"
          className="-ms-3 self-start"
          onPress={() => setAll(true)}
        >
          <ChevronDown aria-hidden size={18} />
          {words.showMore(hidden)}
        </Button>
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
    <Card aria-label={label}>
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
