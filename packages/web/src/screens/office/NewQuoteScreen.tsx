import { useEffect, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  NotPriced,
  formats,
  suggestedPrice,
  type ClientList,
  type ClientListItem,
  type OfficeClientView,
  type CallerQuoteEntry,
  type Condition,
  type HomeRooms,
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
  Button,
  FormPage,
  FormPart,
  List,
  ListItem,
  TextField,
  useSettled,
} from "@empire-cleaning/ui";
import { getJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { clientName, screenWords } from "../format.ts";
import { FoldedPrice } from "./QuoteAsked.tsx";
import { onSite } from "./WorkedOutQuote.tsx";
import { reportUnexpected } from "../../monitoring.ts";

const { cleaners, formatFloorArea } = screenWords.en;
const { formatMoney } = formats.en;

export type NewQuoteSearch = { clientId?: string };

// the page, and the Buttons that open it
export const NEW_QUOTE = "New quote";

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

  const page = {
    trail: [
      { label: "Quotes", href: linkTo({ to: "/office/quotes" }) },
      { label: NEW_QUOTE },
    ],
    title: NEW_QUOTE,
    about: {
      label: "About this page",
      children: (
        <p className="text-sm text-fg-muted">
          For someone who phones. You'll go straight to the draft.
        </p>
      ),
    },
  };

  // who's calling first: the rest waits for them
  if (!client && !isNewClient) {
    return (
      <FormPage {...page}>
        <FindClient
          onChoose={(id) => choose(id)}
          onNew={() => setNewClient(true)}
        />
      </FormPage>
    );
  }

  const price = priceSoFar(ask, client, list, services);
  return (
    <QuoteRequestForm<CallerQuoteEntry>
      // a fresh form for each Client
      key={client?.id ?? "new"}
      headingLevel={2}
      asker={{ kind: "office", client: client && homesOf(client) }}
      page={{
        contactActions: (
          <Button variant="text" size="sm" onPress={() => setNewClient(false)}>
            <Search aria-hidden size={16} />
            Find a client
          </Button>
        ),
        layout: ({ parts, end, isSending, submit }) => (
          <FormPage
            {...page}
            aside={{
              title: "What it comes to",
              leads: true,
              children: <PriceSoFar price={price} />,
            }}
            end={end}
            footer={{
              label: submit,
              summary:
                price &&
                `${price.now.serviceName} ${formatMoney(price.now.totalCents)}`,
              status: price ? undefined : PICK_FIRST,
              children: (
                <Button type="submit" isPending={isSending}>
                  {submit}
                </Button>
              ),
            }}
          >
            {client && (
              <Caller client={client} onChange={() => choose(undefined)} />
            )}
            {parts}
          </FormPage>
        ),
      }}
      onAskChange={setAsk}
      submit={(body) =>
        postQuoteRequest<CallerQuoteEntry>(
          "/api/quotes/caller",
          body,
          "same-origin",
          "en",
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
    <FormPart
      title="Who's calling"
      actions={
        <Button variant="text" size="sm" onPress={onChange}>
          <Users aria-hidden size={16} />
          Someone else
        </Button>
      }
    >
      <div className="flex items-center gap-3">
        <Avatar src={null} />
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold text-fg">{clientName(client)}</span>
          <span className="text-sm [overflow-wrap:anywhere] text-fg-muted">
            {[client.email ?? "No email", client.phone].join(" · ")}
          </span>
        </div>
      </div>
    </FormPart>
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
          ? `${formatFloorArea(area)}, a business`
          : "A business, floor area not given",
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

// what the footer says before a Service is picked, and the aside too
const PICK_FIRST = "Pick what they need to see what it comes to.";

// What's been said so far comes to, worked out as the Draft's Suggested
// Price will be, so it can be said on the phone (#96); none until it can be
const priceSoFar = (
  ask: QuoteAsk | null,
  client: OfficeClientView | null,
  list: PriceList,
  services: Service[],
) => {
  const service = ask && services.find((s) => s.key === ask.serviceKey);
  const what = ask && pricing(ask, client);
  if (!ask || !service || !what) return null;
  try {
    const now = suggestedPrice(
      list,
      service,
      what.priced,
      what.condition,
      list.addOns.filter((a) => ask.addOns?.includes(a.key)),
    );
    return {
      now,
      place: what.place,
      condition: service.conditionApplies
        ? (what.condition ?? "moderate")
        : null,
      business: what.priced.kind === "commercial",
      // the usual crew, as the Draft starts with
      crewSize: list.defaultCrewSize,
    };
  } catch (e) {
    // a place the Service isn't priced for: nothing to show yet. A bug is
    // reported on each render, which Sentry sends once (its Dedupe drops
    // a repeat of the last error)
    if (!(e instanceof NotPriced)) reportUnexpected(e);
    return null;
  }
};

// the price so far, as the Draft's are shown (#434): its total, read out as
// it changes, and how it's worked out, folded, with how long the clean
// takes, which a caller asks
function PriceSoFar({ price }: { price: ReturnType<typeof priceSoFar> }) {
  if (!price) return <p className="text-sm text-fg-muted">{PICK_FIRST}</p>;
  const { now, place, condition, business, crewSize } = price;
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm text-fg-muted">{now.serviceName}</span>
      <FoldedPrice
        price={now}
        working={now}
        live
        under={
          <span className="text-sm text-fg-muted">
            {place}
            {condition ? `, in ${condition} condition` : ""}
          </span>
        }
      >
        {/* none yet, e.g. a business with no floor area given */}
        {now.labourHours > 0 && (
          <p className="text-sm text-fg-muted">
            About {onSite(now.labourHours, crewSize)} on site for{" "}
            {cleaners(crewSize)}.
          </p>
        )}
      </FoldedPrice>
      {business && (
        <p className="text-sm text-fg-muted">
          A first idea: a business is priced after its site visit.
        </p>
      )}
    </div>
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

  // once typing pauses; an older search's answer never lands over a newer
  // one's
  const q = useSettled(text);
  useEffect(() => {
    if (!q) {
      setFound(undefined);
      return;
    }
    let stale = false;
    void getJson<ClientList>(
      `/api/clients?q=${encodeURIComponent(q)}&standing=all`,
    ).then(({ clients }) => {
      if (!stale) setFound({ q, clients });
    });
    return () => {
      stale = true;
    };
  }, [q]);

  return (
    <FormPart
      title="Who's calling"
      actions={
        <Button variant="text" size="sm" onPress={onNew}>
          <UserPlus aria-hidden size={16} />
          New client
        </Button>
      }
    >
      <TextField
        label="Find a client"
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
              No clients match “{found.q}”. Add them as a new client.
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
    </FormPart>
  );
}
