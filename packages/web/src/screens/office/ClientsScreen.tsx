import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import {
  Avatar,
  Heading,
  List,
  ListItem,
  TextField,
} from "@empire-cleaning/ui";
import { clientName } from "../format.ts";

export type ClientsSearch = { q?: string };

// how long typing pauses before the list follows it
const SEARCH_DELAY_MS = 250;

// every Client, searchable by name, email, phone or Property address; open
// one to see their contact details and homes. The search lives in the URL,
// so coming Back from a Client keeps it.
export function ClientsScreen() {
  const clients = useLoaderData({ from: "/office/clients" });
  const { q = "" } = useSearch({ from: "/office/clients" });
  const navigate = useNavigate();
  const [text, setText] = useState(q);

  // the list follows the box once typing pauses
  useEffect(() => {
    const wanted = text.trim();
    if (wanted === q) return;
    const timer = setTimeout(
      () =>
        void navigate({
          to: "/office/clients",
          search: { q: wanted || undefined },
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

  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Clients</Heading>
      <TextField
        label="Search Clients"
        type="search"
        placeholder="Name, email, phone or address"
        value={text}
        onChange={setText}
        autoFocus
      />
      <List
        aria-label="Clients"
        onAction={(id) =>
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
            // how to reach them, without opening them
            description={
              <span className="[overflow-wrap:anywhere]">
                {[client.email, client.phone].filter(Boolean).join(" · ")}
              </span>
            }
          />
        ))}
      </List>
    </div>
  );
}
