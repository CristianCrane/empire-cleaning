import { useEffect, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  suggestedPrice,
  type ClientList,
  type ClientListItem,
  type OfficeClientView,
  type CallerQuoteEntry,
  type Condition,
  type HomeRooms,
  type PriceBreakdown,
  type PriceList,
  type Priced,
  type QuoteAsk,
  type Service,
} from "@empire-cleaning/models";
import {
  postQuoteRequest,
  QuoteRequestForm,
} from "@empire-cleaning/quote-request";
import {
  Avatar,
  Breadcrumbs,
  Button,
  Card,
  Heading,
  List,
  ListItem,
  Section,
  TextField,
} from "@empire-cleaning/ui";
import { getJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { clientName } from "../format.ts";
import { WorkedOutQuote } from "./WorkedOutQuote.tsx";

export type NewQuoteSearch = { clientId?: string };

// how long typing pauses before the search runs
const SEARCH_DELAY_MS = 250;

/**
 * Quoting someone who phones (#34): find them among the Clients, or enter
 * them (email optional), then describe the home as the form for asking
 * for a Quote does, all on one page in the order a call goes, with what it
 * comes to beside it (#96). That records what they asked, marked as entered
 * by the Office, and opens the Quote with its first Revision drafted,
 * one-off. No receipt is emailed.
 */
export function NewQuoteScreen() {
  const { client, list, services } = useLoaderData({
    from: "/office/quotes/new",
  });
  const navigate = useNavigate();
  const [isNewClient, setNewClient] = useState(false);
  const [ask, setAsk] = useState<QuoteAsk | null>(null);

  const choose = (clientId: string | undefined) => {
    setNewClient(false);
    setAsk(null);
    void navigate({ to: "/office/quotes/new", search: { clientId } });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Quotes", href: linkTo({ to: "/office/quotes" }) },
            { label: "New Quote" },
          ]}
        />
        <Heading level={1}>New Quote</Heading>
        <p className="text-fg-muted">
          For someone who phones. You'll go straight to the Quote Draft.
        </p>
      </div>

      {client || isNewClient ? (
        <QuoteRequestForm<CallerQuoteEntry>
          // a fresh form for each Client
          key={client?.id ?? "new"}
          headingLevel={2}
          asker={{ kind: "office", client: client && homesOf(client) }}
          page={{
            before: client && (
              <Caller client={client} onChange={() => choose(undefined)} />
            ),
            contactActions: (
              <Button
                variant="text"
                size="sm"
                onPress={() => setNewClient(false)}
              >
                <Search aria-hidden size={16} />
                Find a Client
              </Button>
            ),
            aside: (
              <PriceSoFar
                ask={ask}
                client={client}
                list={list}
                services={services}
              />
            ),
          }}
          onAskChange={setAsk}
          submit={(body) =>
            postQuoteRequest<CallerQuoteEntry>(
              "/api/quotes/caller",
              body,
              "same-origin",
            )
          }
          // a caller's Quote starts as a Draft: on to writing it
          onSubmitted={({ quoteId }) =>
            void navigate({
              to: "/office/quotes/$quoteId/draft",
              params: { quoteId },
            })
          }
        />
      ) : (
        <FindClient
          onChoose={(id) => choose(id)}
          onNew={() => setNewClient(true)}
        />
      )}
    </div>
  );
}

// the Client found, who can be changed for someone else
function Caller({
  client,
  onChange,
}: {
  client: OfficeClientView;
  onChange: () => void;
}) {
  return (
    <Section
      title="Who's calling"
      actions={
        <Button variant="text" size="sm" onPress={onChange}>
          <Users aria-hidden size={16} />
          Someone else
        </Button>
      }
    >
      <Card>
        <div className="flex items-center gap-3">
          <Avatar src={null} />
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold text-fg">{clientName(client)}</span>
            <span className="text-sm [overflow-wrap:anywhere] text-fg-muted">
              {[client.email ?? "No email", client.phone].join(" · ")}
            </span>
          </div>
        </div>
      </Card>
    </Section>
  );
}

const bathroomsLabel = (n: number) =>
  `${String(Math.floor(n))}${n % 1 ? "½" : ""}`;

const allKnown = (rooms: Partial<HomeRooms>): rooms is HomeRooms =>
  [rooms.bedrooms, rooms.bathrooms, rooms.storeys].every(
    (n) => typeof n === "number" && Number.isFinite(n),
  ) && typeof rooms.pets === "boolean";

// what's asked, priced as the Draft will be: the place, its name, and its
// Condition, where that's known
const pricing = (
  ask: QuoteAsk,
  client: OfficeClientView | null,
): { priced: Priced; place: string; condition: Condition | null } | null => {
  if ("new" in ask.property) {
    const p = ask.property.new;
    if (p.kind === "commercial") {
      const area = ask.area ?? p.floorArea ?? null;
      return {
        priced: { kind: "commercial", premisesTypeKey: p.premisesType, area },
        place: area
          ? `${area.toLocaleString("en-US")} sq ft of business premises`
          : "Business premises, floor area not given",
        condition: null,
      };
    }
    const rooms = allKnown(p) ? p : null;
    return {
      priced: {
        kind: "residential",
        rooms: rooms && {
          bedrooms: rooms.bedrooms,
          bathrooms: rooms.bathrooms,
          storeys: rooms.storeys,
          pets: rooms.pets,
        },
        area: ask.area ?? p.floorArea ?? null,
      },
      place: rooms
        ? `A ${rooms.bedrooms}-bedroom, ${bathroomsLabel(rooms.bathrooms)}-bathroom ${p.type}`
        : `A new ${p.type}`,
      condition: ask.condition ?? null,
    };
  }
  const existing = ask.property.existing;
  const p = client?.properties.find((x) => x.id === existing);
  if (!p) return null;
  const place = [p.street, p.unit].filter(Boolean).join(", ");
  if (p.kind === "commercial") {
    return {
      priced: {
        kind: "commercial",
        premisesTypeKey: p.premisesType.key,
        area: ask.area ?? p.floorArea,
      },
      place,
      condition: p.condition,
    };
  }
  const given = ask.property.rooms;
  const known: Partial<HomeRooms> = given ?? {
    bedrooms: p.bedrooms ?? undefined,
    bathrooms: p.bathrooms ?? undefined,
    storeys: p.storeys ?? undefined,
    pets: p.pets ?? undefined,
  };
  return {
    priced: {
      kind: "residential",
      rooms: allKnown(known) ? known : null,
      area: ask.area ?? p.floorArea,
    },
    place,
    condition: ask.condition ?? p.condition,
  };
};

// What's been said so far comes to, worked out as the Draft's Suggested
// Price will be, so it can be said on the phone (#96)
function PriceSoFar({
  ask,
  client,
  list,
  services,
}: {
  ask: QuoteAsk | null;
  client: OfficeClientView | null;
  list: PriceList;
  services: Service[];
}) {
  const service = ask && services.find((s) => s.key === ask.serviceKey);
  const what = ask && pricing(ask, client);
  let now: PriceBreakdown | null = null;
  if (ask && service && what) {
    try {
      now = suggestedPrice(
        list,
        service,
        what.priced,
        what.condition,
        list.addOns.filter((a) => ask.addOns?.includes(a.key)),
      );
    } catch {
      // a place the Service isn't priced for: nothing to show yet
    }
  }
  const business = what?.priced.kind === "commercial";

  return (
    <Section
      title="What it comes to"
      description={
        business
          ? "A first idea: business premises are priced after the Site Visit."
          : "The Suggested Price so far, as the Draft will start with it. You can change it there."
      }
    >
      <Card>
        <div className="flex flex-col gap-4">
          {now && what && service ? (
            <WorkedOutQuote
              now={now}
              place={what.place}
              condition={
                service.conditionApplies ? (what.condition ?? "moderate") : null
              }
              crewSize={list.defaultCrewSize}
            />
          ) : (
            <p className="text-sm text-fg-muted">
              Choose what they need to see what it comes to.
            </p>
          )}
        </div>
      </Card>
    </Section>
  );
}

// a Client's homes for the form, with their open Quotes, so a home isn't
// offered for a Service one of them would overlap
const homesOf = (client: OfficeClientView) => ({
  id: client.id,
  businessName: client.businessName,
  properties: client.properties,
  open: client.properties.flatMap((p) => p.openQuotes),
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
        void getJson<ClientList>(
          `/api/clients?q=${encodeURIComponent(q)}&standing=all`,
        ).then(({ clients }) => setFound({ q, clients })),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <Section
      title="Who's calling"
      actions={
        <Button variant="text" size="sm" onPress={onNew}>
          <UserPlus aria-hidden size={16} />
          New Client
        </Button>
      }
    >
      <Card>
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
        )}
      </Card>
    </Section>
  );
}
