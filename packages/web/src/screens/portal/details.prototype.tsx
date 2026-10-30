// PROTOTYPE: throwaway. The Client's Your details page and a page per
// property, on made-up data, at /prototype/details?case=1..4&layout=A..B
// (&home=<id> for a property's page; no sign-in). A edits in place, B reads
// first and edits in a dialog. For the UX pass (#96). Lives only on
// prototype-portal-details.
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Building2,
  CalendarClock,
  FileText,
  House,
  KeyRound,
  Mail,
  Phone,
  Ruler,
  Sparkles,
  SquarePen,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  ActionRow,
  Actions,
  AppLayout,
  Breadcrumbs,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  IconTile,
  List,
  ListItem,
  type NavItem,
  Section,
  StatusBadge,
  type StatusTone,
  TextField,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { Fact } from "./Fact.tsx";

const here = linkTo({ to: "/prototype/details" });

// ---- made-up data ----

type Home = {
  id: string;
  address: string;
  kind: "home" | "premises";
  // "Apartment", "Office"
  type: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floorArea: string | null;
  condition: string | null;
  access: string | null;
  // where it stands, as the list's badge and line
  status: { tone: StatusTone; label: string; line: string };
  plan: { when: string; name: string } | null;
  next: string | null;
  quotes: {
    id: string;
    title: string;
    line: string;
    badge: string;
    tone: StatusTone;
  }[];
};

type DetailsCase = {
  key: string;
  name: string;
  contact: { name: string; email: string; phone: string; business?: string };
  homes: Home[];
};

const austin: Home = {
  id: "austin",
  address: "41-12 Austin St, 4B, 11375",
  kind: "home",
  type: "Apartment",
  bedrooms: 2,
  bathrooms: 1,
  floorArea: "850 sq ft",
  condition: "Moderate",
  access: "Buzz 4B. Spare key with the doorman, Luis.",
  status: {
    tone: "success",
    label: "Service Plan",
    line: "Mondays at 9:00 AM",
  },
  plan: { when: "Every week, Mondays at 9:00 AM", name: "Standard Clean" },
  next: "Mon, Nov 2, 9:00 AM",
  quotes: [
    {
      id: "q1",
      title: "Service Plan Quote EC-Q-000012",
      line: "Accepted Oct 5",
      badge: "Accepted",
      tone: "success",
    },
    {
      id: "q0",
      title: "Quote EC-Q-000009",
      line: "Deep Clean · Accepted Sep 20",
      badge: "Accepted",
      tone: "success",
    },
  ],
};

const grand: Home = {
  id: "grand",
  address: "88 Grand St, 11211",
  kind: "home",
  type: "House",
  bedrooms: 4,
  bathrooms: 3,
  floorArea: "2,400 sq ft",
  condition: "Light",
  access: null,
  status: {
    tone: "warning",
    label: "Quote to answer",
    line: "Deep Clean, sent Oct 28",
  },
  plan: null,
  next: null,
  quotes: [
    {
      id: "q2",
      title: "Quote EC-Q-000015",
      line: "Deep Clean · until Nov 4",
      badge: "Sent",
      tone: "warning",
    },
  ],
};

const lake: Home = {
  id: "lake",
  address: "7 Lake Rd, 11530",
  kind: "home",
  type: "House",
  bedrooms: 3,
  bathrooms: 2,
  floorArea: null,
  condition: "Heavy",
  access: "Lockbox on the side gate, code 2468.",
  status: {
    tone: "neutral",
    label: "Nothing booked",
    line: "Last clean Aug 14",
  },
  plan: null,
  next: null,
  quotes: [
    {
      id: "q3",
      title: "Quote EC-Q-000004",
      line: "Move-out Clean · Accepted Aug 1",
      badge: "Accepted",
      tone: "success",
    },
  ],
};

const office: Home = {
  id: "office",
  address: "250 Park Ave S, Fl 6, 10003",
  kind: "premises",
  type: "Office",
  floorArea: "6,000 sq ft",
  condition: "Moderate",
  access: "Front desk signs you in. Ask for Priya.",
  status: {
    tone: "success",
    label: "Service Plan",
    line: "Mon, Wed, Fri at 6:00 PM",
  },
  plan: {
    when: "Every week, Mon, Wed and Fri at 6:00 PM",
    name: "Office Clean",
  },
  next: "Mon, Nov 2, 6:00 PM",
  quotes: [
    {
      id: "q4",
      title: "Service Plan Quote EC-Q-000011",
      line: "Accepted Sep 30",
      badge: "Accepted",
      tone: "success",
    },
  ],
};

const studio: Home = {
  id: "studio",
  address: "19 Bedford Ave, 11222",
  kind: "premises",
  type: "Retail",
  floorArea: null,
  condition: null,
  access: null,
  status: {
    tone: "info",
    label: "Site Visit booked",
    line: "Thu, Nov 5, 10:00 AM",
  },
  plan: null,
  next: null,
  quotes: [
    {
      id: "q5",
      title: "Quote request",
      line: "Asked Oct 29 · a Site Visit first",
      badge: "Requested",
      tone: "info",
    },
  ],
};

const fresh: Home = {
  ...grand,
  id: "fresh",
  address: "12 Elm St, 11101",
  bedrooms: null,
  bathrooms: null,
  floorArea: null,
  condition: null,
  status: { tone: "info", label: "Quote requested", line: "Asked Oct 29" },
  quotes: [
    {
      id: "q6",
      title: "Quote request",
      line: "Standard Clean · asked Oct 29",
      badge: "Requested",
      tone: "info",
    },
  ],
};

const casey = {
  name: "Casey Client",
  email: "casey@example.com",
  phone: "(718) 555-0142",
};

const cases: DetailsCase[] = [
  { key: "1", name: "One home, on a plan", contact: casey, homes: [austin] },
  {
    key: "2",
    name: "Three homes",
    contact: casey,
    homes: [austin, grand, lake],
  },
  {
    key: "3",
    name: "A business, two premises",
    contact: {
      name: "Priya Shah",
      email: "priya@northwind.co",
      phone: "(212) 555-0190",
      business: "Northwind Studio",
    },
    homes: [office, studio],
  },
  { key: "4", name: "New: a Quote asked for", contact: casey, homes: [fresh] },
];

const layouts = [
  { key: "A", name: "Edit in place" },
  { key: "B", name: "Read, then Edit" },
];

// ---- the page ----

export function DetailsPrototype() {
  const {
    case: key = "1",
    layout = "A",
    home,
  } = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
    home?: string;
  };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string; home?: string }) =>
    navigate({
      to: "/prototype/details",
      search: { case: key, layout, home, ...search } as never,
    });
  const c = cases.find((x) => x.key === key) ?? cases[0]!;
  const shown = c.homes.find((h) => h.id === home);

  const nav: NavItem[] = [
    { href: here, label: "Home", icon: House },
    { href: here, label: "Cleans", icon: Sparkles },
    { href: here, label: "Payments", icon: Wallet },
    { href: here, label: "Your details", icon: UserRound, isCurrent: true },
  ];

  return (
    <AppLayout
      area="Client portal"
      nav={nav}
      account={<span className="text-sm text-fg-muted">{c.contact.name}</span>}
    >
      {shown ? (
        <PropertyPage
          home={shown}
          layout={layout}
          backHref={linkTo({
            to: "/prototype/details",
            search: { case: key, layout } as never,
          })}
        />
      ) : (
        <DetailsPage c={c} layout={layout} open={(id) => go({ home: id })} />
      )}
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-40 md:bottom-20"
      />
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={c.key}
        onChange={(k) => go({ case: k, home: undefined })}
      />
    </AppLayout>
  );
}

// ---- Your details ----

function DetailsPage({
  c,
  layout,
  open,
}: {
  c: DetailsCase;
  layout: string;
  open: (id: string) => void;
}) {
  const business = c.contact.business;
  const many = c.homes.length > 1;
  return (
    <div className="flex flex-col gap-6">
      <Heading level={1}>Your details</Heading>

      {layout === "A" ? (
        <Section title="Contact details">
          <Card>
            <ContactForm c={c} />
          </Card>
        </Section>
      ) : (
        <Section title="Contact details" actions={<EditContact c={c} />}>
          <Card>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              <Fact
                icon={UserRound}
                label="Name"
                value={c.contact.name}
                line={business ?? "Name"}
              />
              <Fact
                icon={Mail}
                label="Email"
                value={c.contact.email}
                line="Where we send your Quotes"
              />
              <Fact icon={Phone} label="Phone" value={c.contact.phone} />
            </dl>
          </Card>
        </Section>
      )}

      <Section
        title={business ? "Your premises" : many ? "Your homes" : "Your home"}
        description="Access Instructions, its Service Plan and Quotes are on each one's page."
      >
        <List aria-label="Your properties" onAction={(id) => open(String(id))}>
          {c.homes.map((h) => (
            <ListItem
              key={h.id}
              id={h.id}
              start={<IconTile icon={h.kind === "home" ? House : Building2} />}
              title={h.address}
              description={`${summary(h)} · ${h.status.line}`}
              end={
                <StatusBadge tone={h.status.tone}>{h.status.label}</StatusBadge>
              }
            />
          ))}
        </List>
      </Section>
    </div>
  );
}

function ContactForm({ c }: { c: DetailsCase }) {
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <TextField label="Full name" defaultValue={c.contact.name} />
      <TextField
        label="Email"
        defaultValue={c.contact.email}
        description="Where we send your Quotes. You still sign in the way you do now."
      />
      <TextField label="Phone" defaultValue={c.contact.phone} />
      <Actions>
        <Button type="submit">Save details</Button>
      </Actions>
    </Form>
  );
}

function EditContact({ c }: { c: DetailsCase }) {
  return (
    <DialogTrigger>
      <Button variant="text">
        <SquarePen aria-hidden size={18} />
        Edit
      </Button>
      <Dialog title="Your contact details">
        {({ close }) => (
          <Form onSubmit={(e) => (e.preventDefault(), close())}>
            <TextField
              label="Full name"
              defaultValue={c.contact.name}
              autoFocus
            />
            <TextField
              label="Email"
              defaultValue={c.contact.email}
              description="Where we send your Quotes. You still sign in the way you do now."
            />
            <TextField label="Phone" defaultValue={c.contact.phone} />
            <Actions>
              <Button variant="quiet" onPress={close}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

const summary = (h: Home) =>
  h.kind === "premises"
    ? [h.type, h.floorArea ?? "size not known yet"].join(" · ")
    : [
        h.type,
        h.bedrooms == null
          ? "rooms not known yet"
          : `${h.bedrooms} bed, ${h.bathrooms} bath`,
      ].join(" · ");

// ---- a property's page ----

function PropertyPage({
  home: h,
  layout,
  backHref,
}: {
  home: Home;
  layout: string;
  backHref: ReturnType<typeof linkTo>;
}) {
  const premises = h.kind === "premises";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Your details", href: backHref },
            { label: h.address },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{h.address.split(",")[0]}</Heading>
          <StatusBadge tone={h.status.tone}>{h.status.label}</StatusBadge>
        </div>
        <p className="text-fg-muted">{h.address}</p>
      </div>

      <Section
        title={premises ? "Premises details" : "Home details"}
        actions={layout === "B" ? <EditAccess h={h} /> : undefined}
      >
        <Card>
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <IconTile icon={premises ? Building2 : House} size="lg" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm text-fg-muted">{h.type}</p>
                <p className="text-xl font-semibold text-fg">
                  {summaryHead(h)}
                </p>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact
                icon={Ruler}
                label="Floor area"
                value={h.floorArea ?? "Not known yet"}
              />
              <Fact
                icon={Sparkles}
                label="Condition"
                value={h.condition ?? "Not known yet"}
                line="Condition, at the last clean"
              />
              {layout === "B" && (
                <Fact
                  icon={KeyRound}
                  label="Access Instructions"
                  value={h.access ?? "None yet"}
                  line="How we get in: only your Cleaners see it"
                  className="sm:col-span-2"
                />
              )}
            </dl>
            <p className="border-t border-border pt-4 text-sm text-fg-muted">
              To change its size or rooms, ask for a new Quote: they set the
              price.
            </p>
          </div>
        </Card>
      </Section>

      {layout === "A" && (
        <Section
          title="Access Instructions"
          description="Door codes, where the key is, parking. Only your Cleaners see this."
        >
          <Card>
            <Form onSubmit={(e) => e.preventDefault()}>
              <TextField
                label="How do we get in?"
                multiline
                defaultValue={h.access ?? ""}
              />
              <Actions>
                <Button type="submit" variant="secondary">
                  Save Access Instructions
                </Button>
              </Actions>
            </Form>
          </Card>
        </Section>
      )}

      <Section title="Service Plan">
        {h.plan ? (
          <List aria-label="Service Plan" onAction={() => {}}>
            <ListItem
              id="plan"
              start={<IconTile icon={CalendarClock} />}
              title={h.plan.when}
              description={`${h.plan.name} · next clean ${h.next}`}
              end={<StatusBadge tone="success">Active</StatusBadge>}
            />
          </List>
        ) : (
          <Card>
            <ActionRow
              actions={<Button variant="secondary">Request a Quote</Button>}
            >
              <p>
                No Service Plan here yet. Ask for a Quote for regular cleans,
                and save on each one.
              </p>
            </ActionRow>
          </Card>
        )}
      </Section>

      <Section title="Quotes">
        <List aria-label="Quotes" onAction={() => {}}>
          {h.quotes.map((q) => (
            <ListItem
              key={q.id}
              id={q.id}
              start={<IconTile icon={FileText} />}
              title={q.title}
              description={q.line}
              end={<StatusBadge tone={q.tone}>{q.badge}</StatusBadge>}
            />
          ))}
        </List>
      </Section>
    </div>
  );
}

const summaryHead = (h: Home) =>
  h.kind === "premises"
    ? (h.floorArea ?? "Size not known yet")
    : h.bedrooms == null
      ? "Rooms not known yet"
      : `${h.bedrooms === 0 ? "Studio" : `${h.bedrooms} bedrooms`}, ${h.bathrooms} bathroom${h.bathrooms === 1 ? "" : "s"}`;

function EditAccess({ h }: { h: Home }) {
  return (
    <DialogTrigger>
      <Button variant="text">
        <KeyRound aria-hidden size={18} />
        Edit Access Instructions
      </Button>
      <Dialog title="Access Instructions">
        {({ close }) => (
          <Form onSubmit={(e) => (e.preventDefault(), close())}>
            <TextField
              label="How do we get in?"
              multiline
              autoFocus
              defaultValue={h.access ?? ""}
              description="Door codes, where the key is, parking. Only your Cleaners see this."
            />
            <Actions>
              <Button variant="quiet" onPress={close}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}
