// PROTOTYPE: throwaway (#96). How the Clients list copes as it grows:
// /office/clients?variant=A|B|C|D. A few hundred fake Clients join the real
// ones, in the browser only, and every Client's standing (Active, Quoting,
// Past) is made up from their id: the API doesn't work it out yet.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { ClientListItem } from "@empire-cleaning/models";
import {
  Avatar,
  Button,
  Cell,
  Column,
  List,
  ListItem,
  Row,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableHeader,
  Tabs,
} from "@empire-cleaning/ui";
import { clientName } from "../format.ts";

export const variants = [
  { key: "A", name: "Current: everyone" },
  { key: "B", name: "Everyone, Show more" },
  { key: "C", name: "Active only, search everyone" },
  { key: "D", name: "Table + status Tabs" },
];

type Standing = "active" | "quoting" | "past";
const standingLabel: Record<Standing, string> = {
  active: "Active",
  quoting: "Quoting",
  past: "Past",
};

const PAGE = 50;

const firstNames = [
  "Ava",
  "Ben",
  "Carla",
  "Dev",
  "Elena",
  "Femi",
  "Grace",
  "Hiro",
  "Ines",
  "Jamal",
  "Kira",
  "Leo",
  "Maya",
  "Nico",
  "Olga",
  "Priya",
  "Quinn",
  "Rosa",
  "Sami",
  "Tara",
  "Umar",
  "Vera",
  "Wes",
  "Yara",
  "Zane",
];
const lastNames = [
  "Adams",
  "Brooks",
  "Chen",
  "Diaz",
  "Evans",
  "Fischer",
  "Garcia",
  "Hughes",
  "Ito",
  "Jones",
  "Khan",
  "Lopez",
  "Murphy",
  "Nguyen",
  "Okafor",
  "Patel",
  "Rossi",
];

// 425 people who asked over the years, made up
const fakeClients: ClientListItem[] = firstNames.flatMap((first, i) =>
  lastNames.map((last, j) => ({
    id: `fake-${i}-${j}`,
    name: `${first} ${last}`,
    businessName: null,
    email: `${first}.${last}@example.com`.toLowerCase(),
    phone: `(718) 555-${String(1000 + i * 37 + j * 11).slice(-4)}`,
    imageUrl: null,
  })),
);

// made up from the id: about 1 in 6 Active, 1 in 12 Quoting, the rest Past
const standingOf = (id: string): Standing => {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const n = hash % 12;
  return n < 2 ? "active" : n < 3 ? "quoting" : "past";
};

const matches = (client: ClientListItem, q: string) =>
  !q ||
  [clientName(client), client.email, client.phone]
    .join(" ")
    .toLowerCase()
    .includes(q.toLowerCase());

const byName = (a: ClientListItem, b: ClientListItem) =>
  clientName(a).localeCompare(clientName(b));

export function ClientsList({
  variant,
  real,
  q,
}: {
  variant: string;
  // the Clients the API found for the search
  real: ClientListItem[];
  q: string;
}) {
  const all = [...real, ...fakeClients.filter((c) => matches(c, q))].sort(
    byName,
  );
  if (variant === "B") return <ShowMore clients={all} q={q} />;
  if (variant === "C") return <ActiveOnly clients={all} q={q} />;
  if (variant === "D") return <TableWithTabs clients={all} q={q} />;
  return <ClientRows clients={all} q={q} />;
}

function ClientRows({ clients, q }: { clients: ClientListItem[]; q: string }) {
  const navigate = useNavigate();
  return (
    <List
      aria-label="Clients"
      onAction={(id) =>
        String(id).startsWith("fake-") ||
        navigate({
          to: "/office/clients/$clientId",
          params: { clientId: String(id) },
        })
      }
      renderEmptyState={() => (
        <p className="p-6 text-center text-fg-muted">
          {q ? `No Clients match “${q}”.` : "No Clients yet."}
        </p>
      )}
    >
      {clients.map((client) => (
        <ListItem
          key={client.id}
          id={client.id}
          title={clientName(client)}
          start={<Avatar src={client.imageUrl} />}
          description={
            <span className="[overflow-wrap:anywhere]">
              {[client.email, client.phone].filter(Boolean).join(" · ")}
            </span>
          }
        />
      ))}
    </List>
  );
}

// the next page of the list, on asking
function MoreButton({
  shown,
  total,
  onMore,
}: {
  shown: number;
  total: number;
  onMore: () => void;
}) {
  if (shown >= total) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-fg-muted">
        Showing {shown} of {total}
      </p>
      <Button variant="secondary" onPress={onMore}>
        Show more
      </Button>
    </div>
  );
}

function ShowMore({ clients, q }: { clients: ClientListItem[]; q: string }) {
  const [limit, setLimit] = useState(PAGE);
  return (
    <div className="flex flex-col gap-4">
      <ClientRows clients={clients.slice(0, limit)} q={q} />
      <MoreButton
        shown={Math.min(limit, clients.length)}
        total={clients.length}
        onMore={() => setLimit(limit + PAGE)}
      />
    </div>
  );
}

function ActiveOnly({ clients, q }: { clients: ClientListItem[]; q: string }) {
  // a search looks through everyone
  if (q) return <ShowMore clients={clients} q={q} />;
  const active = clients.filter((c) => standingOf(c.id) === "active");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">
        {active.length} Clients with a Service Plan, a Job in the last 90 days
        or coming up. Search to find anyone else.
      </p>
      <ClientRows clients={active} q={q} />
    </div>
  );
}

function TableWithTabs({
  clients,
  q,
}: {
  clients: ClientListItem[];
  q: string;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Standing | "all">("active");
  const [limit, setLimit] = useState(PAGE);
  const of = (s: Standing | "all") =>
    s === "all" ? clients : clients.filter((c) => standingOf(c.id) === s);
  const shown = of(tab).slice(0, limit);
  const tabs: (Standing | "all")[] = ["active", "quoting", "past", "all"];

  return (
    <Tabs
      selectedKey={tab}
      onSelectionChange={(key) => {
        setTab(key as Standing | "all");
        setLimit(PAGE);
      }}
    >
      <TabList aria-label="Standing">
        {tabs.map((s) => (
          <Tab key={s} id={s} count={of(s).length}>
            {s === "all" ? "All" : standingLabel[s]}
          </Tab>
        ))}
      </TabList>
      {tabs.map((s) => (
        <TabPanel key={s} id={s}>
          <div className="flex flex-col gap-4">
            <Table
              aria-label="Clients"
              onRowAction={(id) =>
                String(id).startsWith("fake-") ||
                void navigate({
                  to: "/office/clients/$clientId",
                  params: { clientId: String(id) },
                })
              }
            >
              <TableHeader>
                <Column id="client" isRowHeader>
                  Client
                </Column>
                <Column id="email">Email</Column>
                <Column id="phone">Phone</Column>
              </TableHeader>
              <TableBody
                items={shown}
                renderEmptyState={() => (
                  <p className="p-6 text-center text-fg-muted">
                    {q ? `No Clients match “${q}”.` : "No Clients here."}
                  </p>
                )}
              >
                {(client) => (
                  <Row id={client.id} className="cursor-pointer">
                    <Cell>
                      <span className="flex items-center gap-3">
                        <Avatar src={client.imageUrl} />
                        <span className="font-semibold">
                          {clientName(client)}
                        </span>
                      </span>
                    </Cell>
                    <Cell>
                      <span className="[overflow-wrap:anywhere]">
                        {client.email ?? "—"}
                      </span>
                    </Cell>
                    <Cell className="whitespace-nowrap">{client.phone}</Cell>
                  </Row>
                )}
              </TableBody>
            </Table>
            <MoreButton
              shown={shown.length}
              total={of(tab).length}
              onMore={() => setLimit(limit + PAGE)}
            />
          </div>
        </TabPanel>
      ))}
    </Tabs>
  );
}
