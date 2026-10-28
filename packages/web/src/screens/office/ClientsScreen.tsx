import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import type { ClientStanding } from "@empire-cleaning/models";
import {
  Avatar,
  Button,
  Cell,
  Column,
  Heading,
  Row,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableHeader,
  Tabs,
  TextField,
} from "@empire-cleaning/ui";
import { clientName } from "../format.ts";

// the list's Tabs, Active first: who the Office is dealing with now
export const clientTabs = ["active", "quoting", "past", "all"] as const;
export type ClientTab = (typeof clientTabs)[number];

const tabLabel: Record<ClientTab, string> = {
  active: "Active",
  quoting: "Quoting",
  past: "Past",
  all: "All",
};

// what a Tab holds, for when it's empty
const noneIn: Record<ClientStanding, string> = {
  active: "No Active Clients.",
  quoting: "No Clients waiting on a Quote.",
  past: "No Past Clients.",
};

// a page of the list, and how many more Show more adds
export const CLIENTS_PAGE = 50;

// tab: as picked; shown: how many Show more has brought up to
export type ClientsSearch = { q?: string; tab?: ClientTab; shown?: number };

// the Tab unless one is picked: Active, or All while searching, since the
// Client someone is looking for may be any of them
export const tabFor = ({ q, tab }: ClientsSearch): ClientTab =>
  tab ?? (q ? "all" : "active");

// how long typing pauses before the list follows it
const SEARCH_DELAY_MS = 250;

// The Office's Clients as a Table (#96), a Tab per standing with its count:
// Active (a Service Plan, or a Job coming up or in the last 90 days) first,
// then Quoting, Past and All. A search by name, email, phone or address
// looks through All, or the Tab picked. A Tab holds 50 at a time, Show more adds 50, so the
// list stays quick however many Clients there are. The search, Tab and how
// many are shown live in the URL, so coming Back from a Client keeps them.
export function ClientsScreen() {
  const { clients, counts } = useLoaderData({ from: "/office/clients" });
  const search = useSearch({ from: "/office/clients" });
  const { q = "", shown = CLIENTS_PAGE } = search;
  const tab = tabFor(search);
  const navigate = useNavigate({ from: "/office/clients" });
  const [text, setText] = useState(q);

  // the list follows the box once typing pauses
  useEffect(() => {
    const wanted = text.trim();
    if (wanted === q) return;
    const timer = setTimeout(
      () =>
        void navigate({
          to: "/office/clients",
          search: (prev) => ({
            ...prev,
            q: wanted || undefined,
            shown: undefined,
          }),
          replace: true,
        }),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [text, q, navigate]);

  // and the box follows the URL, e.g. the nav's Clients link clearing it
  useEffect(() => {
    setText((current) => (current.trim() === q ? current : q));
  }, [q]);

  const table = (
    <Table
      aria-label="Clients"
      onRowAction={(id) =>
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
        {/* on a phone, email and phone sit under the name instead */}
        <Column id="email" className="hidden md:table-cell">
          Email
        </Column>
        <Column id="phone" className="hidden md:table-cell">
          Phone
        </Column>
      </TableHeader>
      <TableBody
        items={clients}
        renderEmptyState={() => (
          <p className="p-6 text-center text-fg-muted">
            {q
              ? `No Clients match “${q}”.`
              : tab === "all"
                ? "No Clients yet."
                : noneIn[tab]}
          </p>
        )}
      >
        {(client) => (
          <Row id={client.id} className="cursor-pointer">
            <Cell>
              <span className="flex items-center gap-3">
                <Avatar src={client.imageUrl} />
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{clientName(client)}</span>
                  <span className="text-sm text-fg-muted [overflow-wrap:anywhere] md:hidden">
                    {[client.email, client.phone].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </span>
            </Cell>
            <Cell className="hidden md:table-cell">
              <span className="[overflow-wrap:anywhere]">
                {client.email ?? "—"}
              </span>
            </Cell>
            <Cell className="hidden whitespace-nowrap md:table-cell">
              {client.phone}
            </Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="flex flex-col gap-6">
      <Heading level={1}>Clients</Heading>
      <TextField
        label="Search Clients"
        type="search"
        placeholder="Name, email, phone or address"
        value={text}
        onChange={setText}
        autoFocus
      />
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) =>
          void navigate({
            to: "/office/clients",
            search: (prev) => ({
              ...prev,
              // as it is unless it's what the search would pick anyway
              tab:
                key === tabFor({ q: prev.q }) ? undefined : (key as ClientTab),
              shown: undefined,
            }),
            replace: true,
          })
        }
      >
        <TabList aria-label="Standing">
          {clientTabs.map((t) => (
            <Tab key={t} id={t} count={counts[t]}>
              {tabLabel[t]}
            </Tab>
          ))}
        </TabList>
        {clientTabs.map((t) => (
          <TabPanel key={t} id={t}>
            <div className="flex flex-col gap-4">
              {table}
              {clients.length < counts[tab] && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-fg-muted">
                    Showing {clients.length} of {counts[tab]}
                  </p>
                  <Button
                    variant="secondary"
                    onPress={() =>
                      void navigate({
                        to: "/office/clients",
                        search: (prev) => ({
                          ...prev,
                          shown: shown + CLIENTS_PAGE,
                        }),
                        replace: true,
                        resetScroll: false,
                      })
                    }
                  >
                    Show more
                  </Button>
                </div>
              )}
            </div>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
