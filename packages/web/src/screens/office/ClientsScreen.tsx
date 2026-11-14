import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import type { ClientListItem, ClientStanding } from "@empire-cleaning/models";
import {
  Avatar,
  ListPage,
  StatusBadge,
  type StatusTone,
} from "@empire-cleaning/ui";
import { clientName } from "../format.ts";
import { tabShown, useListUrl } from "../list-search.ts";

// the list's Tabs, Active first: who the Office is dealing with now
export const clientTabs = ["active", "quoting", "past"] as const;

const tabLabel: Record<ClientStanding, string> = {
  active: "Active",
  quoting: "Quoting",
  past: "Past",
};

const standingTone: Record<ClientStanding, StatusTone> = {
  active: "success",
  quoting: "info",
  past: "neutral",
};

// what a Tab holds, for when it's empty
const noneIn: Record<ClientStanding, string> = {
  active: "No active clients.",
  quoting: "No clients waiting on a quote.",
  past: "No past clients.",
};

const contactOf = (client: ClientListItem) =>
  [client.email, client.phone].filter(Boolean).join(" · ");

// The Office's Clients (#96, #433), a List: a Tab per standing with its
// count, Active (a Service Plan, or a Job coming up or in the last 90 days)
// first, then Quoting and Past. A search by name, email, phone or address
// looks through every Tab, and says each one's standing. A Tab holds 50 at
// a time, Show more adds 50, so the list stays quick however many Clients
// there are
export function ClientsScreen() {
  const { clients, counts } = useLoaderData({ from: "/office/clients" });
  const url = useListUrl<ClientStanding>();
  const navigate = useNavigate();
  const tab = tabShown(clientTabs, url.tab);

  return (
    <ListPage
      title="Clients"
      tabs={clientTabs.map((t) => ({
        id: t,
        label: tabLabel[t],
        count: counts[t],
        none: noneIn[t],
      }))}
      tab={tab}
      onTabChange={url.onTabChange}
      search={{
        label: "Search clients",
        placeholder: "Name, email, phone or address",
        query: url.q,
        onSearch: url.onSearch,
        found: counts.all,
      }}
      items={clients}
      row={(client) => ({
        id: client.id,
        title: clientName(client),
        description: (
          <span className="[overflow-wrap:anywhere]">{contactOf(client)}</span>
        ),
        start: <Avatar src={client.imageUrl} />,
        // its Tab says it, but a search across them doesn't
        status: {
          badge: (
            <StatusBadge tone={standingTone[client.standing]}>
              {tabLabel[client.standing]}
            </StatusBadge>
          ),
          plain: true,
        },
        onOpen: () =>
          void navigate({
            to: "/office/clients/$clientId",
            params: { clientId: client.id },
          }),
      })}
      columns={[
        {
          id: "client",
          label: "Client",
          cell: (client) => (
            <span className="flex items-center gap-3">
              <Avatar src={client.imageUrl} />
              {clientName(client)}
            </span>
          ),
        },
        {
          id: "email",
          label: "Email",
          cell: (client) => (
            <span className="[overflow-wrap:anywhere]">
              {client.email ?? "—"}
            </span>
          ),
        },
        {
          id: "phone",
          label: "Phone",
          cell: (client) => (
            <span className="whitespace-nowrap">{client.phone}</span>
          ),
        },
      ]}
      more={{ onMore: url.onMore }}
      empty={{ icon: Users, title: "No clients yet" }}
    />
  );
}
