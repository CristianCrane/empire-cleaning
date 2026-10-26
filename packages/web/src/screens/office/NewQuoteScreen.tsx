import { useEffect, useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type {
  ClientListItem,
  OfficeClientView,
  OfficeRequestEntry,
} from "@empire-cleaning/models";
import {
  postQuoteRequest,
  QuoteRequestForm,
} from "@empire-cleaning/quote-request";
import {
  Breadcrumbs,
  Button,
  Card,
  Heading,
  List,
  ListItem,
  TextField,
} from "@empire-cleaning/ui";
import { getJson } from "../../api.ts";
import { linkTo } from "../../links.ts";

export type NewQuoteSearch = { clientId?: string };

// how long typing pauses before the search runs
const SEARCH_DELAY_MS = 250;

/**
 * Quoting someone who phones (#34): find them among the Clients, or enter
 * them (email optional), then describe the home as the Quote Request form
 * asks. That records their request, marked as entered by the Office, and
 * opens a one-off Quote Draft answering it. No receipt is emailed.
 */
export function NewQuoteScreen() {
  const client = useLoaderData({ from: "/office/quotes/new" });
  const navigate = useNavigate();
  const [isNewClient, setNewClient] = useState(false);

  const choose = (clientId: string | undefined) => {
    setNewClient(false);
    void navigate({ to: "/office/quotes/new", search: { clientId } });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Requests", href: linkTo({ to: "/office/requests" }) },
            { label: "New Quote" },
          ]}
        />
        <Heading level={1}>New Quote</Heading>
        <p className="text-fg-muted">
          For someone who phones: find them or enter them, then describe their
          home. You'll go straight to the Quote Draft.
        </p>
      </div>

      {client ? (
        <Card
          title={client.name}
          description={[client.email ?? "No email", client.phone].join(" · ")}
          actions={
            <Button variant="secondary" onPress={() => choose(undefined)}>
              Choose someone else
            </Button>
          }
        />
      ) : isNewClient ? (
        <Card
          title="New Client"
          description="Enter their details with the home below."
          actions={
            <Button variant="secondary" onPress={() => setNewClient(false)}>
              Find a Client instead
            </Button>
          }
        />
      ) : (
        <FindClient
          onChoose={(id) => choose(id)}
          onNew={() => setNewClient(true)}
        />
      )}

      {(client || isNewClient) && (
        <Card>
          <QuoteRequestForm<OfficeRequestEntry>
            // a fresh form for each Client
            key={client?.id ?? "new"}
            headingLevel={2}
            asker={{ kind: "office", client: client && homesOf(client) }}
            submit={(body) =>
              postQuoteRequest<OfficeRequestEntry>(
                "/api/quote-requests/office",
                body,
                "same-origin",
              )
            }
            onSubmitted={({ quoteId }) =>
              void navigate({
                to: "/office/quotes/$quoteId",
                params: { quoteId },
              })
            }
          />
        </Card>
      )}
    </div>
  );
}

// a Client's homes for the form, those with a request waiting not offered
const homesOf = (client: OfficeClientView) => ({
  id: client.id,
  properties: client.properties,
  waiting: client.properties
    .filter((p) => p.status.kind === "request_waiting")
    .map((p) => p.id),
});

// the Clients search, as on the Clients screen: name, email, phone or
// Property address
function FindClient({
  onChoose,
  onNew,
}: {
  onChoose: (clientId: string) => void;
  onNew: () => void;
}) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<{
    q: string;
    clients: ClientListItem[];
  }>();

  useEffect(() => {
    const q = text.trim();
    if (!q) {
      setFound(undefined);
      return;
    }
    const timer = setTimeout(
      () =>
        void getJson<ClientListItem[]>(
          `/api/clients?q=${encodeURIComponent(q)}`,
        ).then((clients) => setFound({ q, clients })),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <Card
      title="Who's calling?"
      actions={
        <Button variant="secondary" onPress={onNew}>
          New Client
        </Button>
      }
    >
      <TextField
        label="Find a Client"
        type="search"
        placeholder="Name, email, phone or address"
        value={text}
        onChange={setText}
        autoFocus
      />
      {found && (
        <List
          aria-label="Clients found"
          onAction={(id) => onChoose(String(id))}
          renderEmptyState={() => (
            <p className="p-4 text-center text-fg-muted">
              No Clients match “{found.q}”. Add them as a New Client.
            </p>
          )}
        >
          {found.clients.map((client) => (
            <ListItem
              key={client.id}
              id={client.id}
              title={client.name}
              description={
                <span className="[overflow-wrap:anywhere]">
                  {[client.email, client.phone].filter(Boolean).join(" · ")}
                </span>
              }
            />
          ))}
        </List>
      )}
    </Card>
  );
}
