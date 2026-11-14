// PROTOTYPE: throwaway. The Settings layout (#436), on made-up data, at
// /prototype/settings?layout=A..C&case=1..4 (no sign-in), inside the real
// AppLayout and nav of each case's area. ↑/↓ switch layouts, ←/→ switch
// cases. Lives only on prototype-settings.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  BadgePercent,
  Building2,
  CalendarClock,
  Gauge,
  Home,
  Mail,
  Percent,
  Phone,
  Plus,
  Receipt,
  SquarePen,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Actions,
  AppLayout,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Fact,
  Facts,
  Fold,
  FormPart,
  List,
  ListItem,
  type NavItem,
  Notice,
  PageHeader,
  Section,
  StatusBadge,
  type StatusTone,
  TextField,
  showToast,
} from "@empire-cleaning/ui";
import { areaLabels, type AreaId } from "../session.ts";
import { navFor } from "./AreaLayout.tsx";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";

const say = (title: string) => () => showToast({ title, tone: "info" });

// ---- the shape of a Settings page, as every layout reads it ----

type FactRow = {
  icon: LucideIcon;
  label: string;
  value: string;
  line?: string;
};

// a part read as facts, changed in its own dialog
type FactsPart = {
  kind: "facts";
  title: string;
  // what it's set to, in one line (B's row, C's fold)
  summary: string;
  facts: FactRow[];
  // what used to be the Section's description: only in the dialog now
  explain?: string;
  fields: { label: string; value: string; description?: string }[];
};

type Row = {
  id: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  badge?: { text: string; tone?: StatusTone };
  retired?: boolean;
};

// a part read as rows, each opened on its own
type RowsPart = {
  kind: "rows";
  title: string;
  summary: string;
  rows: Row[];
  add?: string;
  // with no rows
  empty: string;
  explain?: string;
};

type Part = FactsPart | RowsPart;

type SettingsCase = {
  key: string;
  name: string;
  area: AreaId;
  navLabel: string;
  title: string;
  // one muted line under the title: which version
  subtitle?: string;
  notice?: { tone: "warning" | "info"; text: string; action?: string };
  // said in every save dialog of this page, above its Buttons
  onSave?: string;
  parts: Part[];
};

// ---- the cases ----

const prices = (busy: boolean): Part[] => [
  {
    kind: "rows",
    title: "Extras",
    add: "Add an extra",
    empty: "No extras yet",
    explain:
      "For homes, businesses or both, priced by their hours. Clients asking about a home see the ones for homes. A business's are agreed after a visit.",
    summary: busy ? "7 in use · 1 retired" : "None yet",
    rows: busy
      ? [
          {
            id: "fridge",
            title: "Inside the fridge",
            description: "30 min · Deep, Standard",
          },
          {
            id: "oven",
            title: "Inside the oven",
            description: "45 min · Deep, Standard, Move-out",
          },
          {
            id: "windows",
            title: "Interior windows",
            description: "1 hr · Deep, Move-out",
          },
          {
            id: "laundry",
            title: "Laundry, wash and fold",
            description: "1 hr · Standard · Tax-exempt",
          },
          {
            id: "cabinets",
            title: "Inside cabinets",
            description: "1 hr 30 min · Move-out",
          },
          {
            id: "balcony",
            title: "Balcony",
            description: "30 min · Standard, Deep",
          },
          {
            id: "walls",
            title: "Wall spots",
            description: "30 min · Deep, Office cleaning",
          },
          {
            id: "closet",
            title: "Organizing a closet",
            description: "2 hr · No service",
            retired: true,
          },
        ]
      : [],
  },
  {
    kind: "rows",
    title: "Types of business",
    add: "Add a type",
    empty: "No types yet: every business is priced as an office",
    explain:
      "How much longer or shorter each takes to clean than an office (1×), for services priced by area that condition affects.",
    summary: busy ? "6 types, 0.7× to 1.5×" : "None yet",
    rows: busy
      ? [
          { id: "office", title: "Office", description: "1×", icon: Building2 },
          {
            id: "retail",
            title: "Retail store",
            description: "1.1×",
            icon: Building2,
          },
          {
            id: "medical",
            title: "Medical office",
            description: "1.3×",
            icon: Building2,
          },
          {
            id: "restaurant",
            title: "Restaurant",
            description: "1.5×",
            icon: Building2,
          },
          { id: "gym", title: "Gym", description: "1.2×", icon: Building2 },
          {
            id: "warehouse",
            title: "Warehouse",
            description: "0.7×",
            icon: Building2,
          },
        ]
      : [],
  },
  {
    kind: "facts",
    title: "Condition",
    summary: busy
      ? "Light 0.85× · Average 1× · Heavy 1.4×"
      : "Light 0.9× · Average 1× · Heavy 1.25×",
    explain:
      "It multiplies a home's or business's hours, for services that condition affects. Extras aren't multiplied.",
    facts: [
      { icon: Gauge, label: "Light condition", value: busy ? "0.85×" : "0.9×" },
      { icon: Gauge, label: "Average condition", value: "1×" },
      { icon: Gauge, label: "Heavy condition", value: busy ? "1.4×" : "1.25×" },
    ],
    fields: [
      { label: "Light (×)", value: busy ? "0.85" : "0.9" },
      { label: "Average (×)", value: "1" },
      { label: "Heavy (×)", value: busy ? "1.4" : "1.25" },
    ],
  },
  {
    kind: "facts",
    title: "Quote defaults",
    summary: busy
      ? "25% deposit · 10% off plans · valid 30 days · 2 cleaners"
      : "20% deposit · 5% off plans · valid 14 days · 1 cleaner",
    explain: "What a new quote starts with. You can change them on the quote.",
    facts: [
      { icon: Percent, label: "Deposit", value: busy ? "25%" : "20%" },
      {
        icon: BadgePercent,
        label: "Plan discount",
        value: busy ? "10%" : "5%",
      },
      {
        icon: CalendarClock,
        label: "Quote valid for",
        value: busy ? "30 days" : "14 days",
      },
      {
        icon: Users,
        label: "Cleaners",
        value: busy ? "2 cleaners" : "1 cleaner",
      },
    ],
    fields: [
      { label: "Deposit (%)", value: busy ? "25" : "20" },
      { label: "Plan discount (%)", value: busy ? "10" : "5" },
      { label: "Quote valid for (days)", value: busy ? "30" : "14" },
      { label: "Cleaners", value: busy ? "2" : "1" },
    ],
  },
  {
    kind: "facts",
    title: "Sales tax on fees",
    summary: busy ? "8.875%" : "0%",
    explain:
      "Added to late cancellation and couldn't-get-in fees. Each service has its own rates for its jobs. Check these with your accountant.",
    facts: [
      { icon: Receipt, label: "Tax on fees", value: busy ? "8.875%" : "0%" },
    ],
    fields: [{ label: "Tax on fees (%)", value: busy ? "8.875" : "0" }],
  },
];

const contact = (
  name: string,
  business: string | undefined,
  email: string,
  phone: string,
): FactsPart => ({
  kind: "facts",
  title: "Contact details",
  summary: [name, email, phone].join(" · "),
  facts: [
    { icon: User, label: "Name", value: name, line: business },
    { icon: Mail, label: "Email", value: email },
    { icon: Phone, label: "Phone", value: phone },
  ],
  fields: [
    { label: "Full name", value: name },
    {
      label: "Email",
      value: email,
      description:
        "Where we send your quotes. We switch to a new one once you open the link we email to it. You still sign in the way you do now.",
    },
    { label: "Phone", value: phone },
  ],
});

const cases: SettingsCase[] = [
  {
    key: "1",
    name: "Prices, busy",
    area: "office",
    navLabel: "Prices",
    title: "Prices",
    subtitle: "Version 7 · saved Nov 3 by Jen",
    onSave:
      "Changes apply to prices worked out from now on. Quotes already sent keep their prices.",
    parts: prices(true),
  },
  {
    key: "2",
    name: "Prices, first time",
    area: "office",
    navLabel: "Prices",
    title: "Prices",
    subtitle: "Starting figures",
    notice: {
      tone: "warning",
      text: "These are starting figures, not yours. Check each before you send a quote.",
      action: "Keep these figures",
    },
    onSave:
      "Changes apply to prices worked out from now on. Quotes already sent keep their prices.",
    parts: prices(false),
  },
  {
    key: "3",
    name: "Your details, busy",
    area: "portal",
    navLabel: "Your details",
    title: "Your details",
    notice: {
      tone: "warning",
      text: "We've emailed a link to grace@leeparkdental.com. Your email changes once you open it.",
    },
    parts: [
      contact(
        "Grace Lee",
        "Lee & Park Dental",
        "grace.lee@gmail.com",
        "(718) 555-0142",
      ),
      {
        kind: "rows",
        title: "Your places",
        summary: "4 places",
        empty: "",
        explain:
          "Each place has its own plan, quotes and visits. Tap one to see them.",
        rows: [
          {
            id: "court",
            title: "214 Court St",
            description: "Dental office · 1,800 sq ft · every 2 weeks",
            icon: Building2,
            badge: { text: "On a plan", tone: "success" },
          },
          {
            id: "atlantic",
            title: "88 Atlantic Ave, Apt 3",
            description: "2 bed, 1 bath · your quote is ready",
            icon: Home,
            badge: { text: "Quote ready", tone: "warning" },
          },
          {
            id: "pierrepont",
            title: "15 Pierrepont St",
            description: "3 bed, 2 bath · visit Thu, Nov 20, 10:00 AM",
            icon: Home,
            badge: { text: "Visit booked", tone: "info" },
          },
          {
            id: "smith",
            title: "310 Smith St",
            description: "Office · 900 sq ft · paused until Jan 5",
            icon: Building2,
            badge: { text: "Paused" },
          },
        ],
      },
    ],
  },
  {
    key: "4",
    name: "Your details, one home",
    area: "portal",
    navLabel: "Your details",
    title: "Your details",
    parts: [
      contact(
        "Maria Gomez",
        undefined,
        "maria.gomez@yahoo.com",
        "(347) 555-0198",
      ),
      {
        kind: "rows",
        title: "Your home",
        summary: "47 Prospect Pl",
        empty: "",
        rows: [
          {
            id: "prospect",
            title: "47 Prospect Pl",
            description: "2 bed, 1 bath · every week",
            icon: Home,
            badge: { text: "On a plan", tone: "success" },
          },
        ],
      },
    ],
  },
];

// ---- the layouts ----

const layouts = [
  { key: "A", name: "Sections, no explaining" },
  { key: "B", name: "One line per part" },
  { key: "C", name: "Every part folded" },
] as const;

type LayoutKey = (typeof layouts)[number]["key"];

const notes: Record<LayoutKey, { idea: string; shows: string; hides: string }> =
  {
    A: {
      idea: "Today's page, with the words cut. The title (in the top bar on a phone) and one muted line: which version. Then each part as a Section: its facts in a card or its rows in a list, its Edit or Add on the Section's title row. No Section has a description.",
      shows:
        "Every figure and every row, open. A starting list's warning first. Retired extras stay in the list, badged.",
      hides:
        "Each part's explanation and \"Quotes already sent keep their prices\": in the part's dialog, above Save. The pointer to Services goes (the nav has it).",
    },
    B: {
      idea: 'Sparest. A settings list: each part of figures is one row saying what it\'s set to ("Light 0.85× · Average 1× · Heavy 1.4×"); a tap opens its dialog, where the figures are read and changed. Parts that are rows (Extras, Types of business, Your places) stay lists under it: each row is already one line.',
      shows:
        'One card of summary rows, then the lists. A starting list\'s warning first. Retired extras fold under "Retired (1)".',
      hides:
        'The figures one by one, each part\'s explanation and the "sent quotes keep their prices" line: all in its dialog.',
    },
    C: {
      idea: "Like the Form layout's pick (Form B): one card, every part a line saying what's set; a tap opens it in place, its facts or rows, with Edit or Add inside. Nothing is open at first.",
      shows:
        "One card of lines, one per part (Extras · 7 in use, 1 retired). A starting list's warning first.",
      hides:
        'Every figure and row behind its line; each part\'s explanation and the "sent quotes" line in its dialog.',
    },
  };

// what this layout's first view shows and hides: the prototype's, not the
// design's (dashed, dismissible)
function LayoutNote({ layout }: { layout: LayoutKey }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const note = notes[layout];
  return (
    <div className="mb-6 flex items-start gap-3 rounded-md border-2 border-dashed border-border p-3 text-sm">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p>
          <strong>Layout {layout}.</strong> {note.idea}
        </p>
        <p>
          <strong>First view:</strong> {note.shows}
        </p>
        <p>
          <strong>Behind a tap:</strong> {note.hides}
        </p>
      </div>
      <Button
        variant="quiet"
        size="icon"
        aria-label="Hide the note"
        onPress={() => setOpen(false)}
      >
        <X aria-hidden size={18} />
      </Button>
    </div>
  );
}

// ---- what every layout shares ----

// a part's dialog: its explanation, its fields, what saving does
function PartDialog({
  part,
  onSave,
  onClose,
}: {
  part: FactsPart;
  onSave?: string;
  // opened from code (B's rows): told when it closes
  onClose?: () => void;
}) {
  return (
    <Dialog
      title={part.title}
      {...(onClose && {
        isOpen: true,
        onOpenChange: (o: boolean) => !o && onClose(),
      })}
    >
      {({ close }) => (
        <div className="flex flex-col gap-4">
          {part.explain && <p className="text-fg-muted">{part.explain}</p>}
          {part.fields.map((f) => (
            <TextField
              key={f.label}
              label={f.label}
              description={f.description}
              defaultValue={f.value}
            />
          ))}
          {onSave && <p className="text-sm text-fg-muted">{onSave}</p>}
          <Actions>
            <Button variant="quiet" onPress={close}>
              Cancel
            </Button>
            <Button
              onPress={() => {
                say(`${part.title} saved`)();
                close();
              }}
            >
              Save
            </Button>
          </Actions>
        </div>
      )}
    </Dialog>
  );
}

function EditButton({ part, onSave }: { part: FactsPart; onSave?: string }) {
  return (
    <DialogTrigger>
      <Button variant="text" size="sm" aria-label={`Edit ${part.title}`}>
        <SquarePen aria-hidden size={16} />
        Edit
      </Button>
      <PartDialog part={part} onSave={onSave} />
    </DialogTrigger>
  );
}

function AddButton({ part }: { part: RowsPart }) {
  return part.add ? (
    <Button variant="text" size="sm" onPress={say(`Opens: ${part.add}`)}>
      <Plus aria-hidden size={16} />
      {part.add}
    </Button>
  ) : null;
}

function FactsCard({ part }: { part: FactsPart }) {
  return (
    <Card>
      <Facts>
        {part.facts.map((f) => (
          <Fact
            key={f.label}
            icon={f.icon}
            label={f.label}
            value={f.value}
            line={f.line}
          />
        ))}
      </Facts>
    </Card>
  );
}

function Rows({ label, rows }: { label: string; rows: Row[] }) {
  return (
    <List aria-label={label}>
      {rows.map((r) => (
        <ListItem
          key={r.id}
          id={r.id}
          title={r.title}
          description={r.description}
          start={
            r.icon ? (
              <r.icon aria-hidden size={20} className="text-fg-muted" />
            ) : undefined
          }
          end={
            r.retired ? (
              <StatusBadge>Retired</StatusBadge>
            ) : r.badge ? (
              <StatusBadge tone={r.badge.tone}>{r.badge.text}</StatusBadge>
            ) : undefined
          }
          onAction={say(`Opens ${r.title}`)}
        />
      ))}
    </List>
  );
}

// the rows, retired ones folded after (B)
function RowsWithRetired({ part }: { part: RowsPart }) {
  const live = part.rows.filter((r) => !r.retired);
  const retired = part.rows.filter((r) => r.retired);
  if (!part.rows.length) return <p className="text-fg-muted">{part.empty}</p>;
  return (
    <div className="flex flex-col gap-3">
      <Rows label={part.title} rows={live} />
      {retired.length > 0 && (
        <Fold label={`Retired (${retired.length})`}>
          <Rows label={`Retired ${part.title.toLowerCase()}`} rows={retired} />
        </Fold>
      )}
    </div>
  );
}

function Header({ c }: { c: SettingsCase }) {
  return (
    <>
      <PageHeader title={c.title} inBar subtitle={c.subtitle} />
      {c.notice && (
        <Notice
          tone={c.notice.tone}
          action={
            c.notice.action ? (
              <Button variant="text" size="sm" onPress={say(c.notice.action)}>
                {c.notice.action}
              </Button>
            ) : undefined
          }
        >
          {c.notice.text}
        </Notice>
      )}
    </>
  );
}

// ---- A: Sections, no explaining ----

function LayoutA({ c }: { c: SettingsCase }) {
  return (
    <div className="flex flex-col gap-6">
      <Header c={c} />
      {c.parts.map((p) =>
        p.kind === "facts" ? (
          <Section
            key={p.title}
            title={p.title}
            actions={<EditButton part={p} onSave={c.onSave} />}
          >
            <FactsCard part={p} />
          </Section>
        ) : (
          <Section
            key={p.title}
            title={p.title}
            actions={<AddButton part={p} />}
          >
            {p.rows.length ? (
              <Rows label={p.title} rows={p.rows} />
            ) : (
              <p className="text-fg-muted">{p.empty}</p>
            )}
          </Section>
        ),
      )}
    </div>
  );
}

// ---- B: one line per part ----

function SummaryRows({ c, parts }: { c: SettingsCase; parts: FactsPart[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const part = parts.find((p) => p.title === open);
  return (
    <>
      <List aria-label="Settings" onAction={(key) => setOpen(String(key))}>
        {parts.map((p) => (
          <ListItem
            key={p.title}
            id={p.title}
            title={p.title}
            description={p.summary}
          />
        ))}
      </List>
      {part && (
        <PartDialog
          part={part}
          onSave={c.onSave}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function LayoutB({ c }: { c: SettingsCase }) {
  const facts = c.parts.filter((p): p is FactsPart => p.kind === "facts");
  const rows = c.parts.filter((p): p is RowsPart => p.kind === "rows");
  return (
    <div className="flex flex-col gap-6">
      <Header c={c} />
      <SummaryRows c={c} parts={facts} />
      {rows.map((p) => (
        <Section key={p.title} title={p.title} actions={<AddButton part={p} />}>
          <RowsWithRetired part={p} />
        </Section>
      ))}
    </div>
  );
}

// ---- C: every part folded ----

function LayoutC({ c }: { c: SettingsCase }) {
  return (
    <div className="flex flex-col gap-6">
      <Header c={c} />
      <Card>
        <div className="flex flex-col">
          {c.parts.map((p) => (
            <FormPart key={p.title} title={p.title} summary={p.summary}>
              {p.kind === "facts" ? (
                <div className="flex flex-col gap-3">
                  <Facts>
                    {p.facts.map((f) => (
                      <Fact
                        key={f.label}
                        icon={f.icon}
                        label={f.label}
                        value={f.value}
                        line={f.line}
                      />
                    ))}
                  </Facts>
                  <div className="self-start">
                    <EditButton part={p} onSave={c.onSave} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <RowsWithRetired part={p} />
                  <div className="self-start">
                    <AddButton part={p} />
                  </div>
                </div>
              )}
            </FormPart>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Layout({ c, layout }: { c: SettingsCase; layout: LayoutKey }) {
  if (layout === "B") return <LayoutB c={c} />;
  if (layout === "C") return <LayoutC c={c} />;
  return <LayoutA c={c} />;
}

export function SettingsPrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const layout: LayoutKey =
    layouts.find((l) => l.key === search.layout)?.key ?? "A";
  const c = cases.find((x) => x.key === search.case) ?? cases[0]!;
  const go = (change: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/settings",
      search: { case: c.key, layout, ...change },
      replace: true,
    });

  const nav: NavItem[] = navFor("en")[c.area].map(
    ({ alsoCurrentFor: _, ...item }) => ({
      ...item,
      isCurrent: item.label === c.navLabel,
    }),
  );
  return (
    <AppLayout area={areaLabels.en[c.area]} nav={nav} foot={() => null}>
      {/* room for the switchers, so they cover nothing of the page at rest */}
      <div aria-hidden className="h-24" />
      <LayoutNote key={layout} layout={layout} />
      <Layout key={`${c.key}-${layout}`} c={c} layout={layout} />
      <PrototypeSwitcher
        variants={layouts.map((l) => ({ key: l.key, name: l.name }))}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="top-16 md:top-3"
      />
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={c.key}
        onChange={(k) => go({ case: k })}
        className="top-28 md:top-15"
      />
    </AppLayout>
  );
}
