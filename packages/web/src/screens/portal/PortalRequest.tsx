import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { QuoteRequestForm } from "@empire-cleaning/quote-request";
import {
  Breadcrumbs,
  Card,
  Heading,
  Link,
  Notice,
  showToast,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { addressOf } from "../format.ts";

// a signed-in Client asking about a new home or one of theirs
export function PortalRequest() {
  const client = useLoaderData({ from: "/portal/request" });
  const navigate = useNavigate();
  const router = useRouter();
  // their open Quotes are pointed to, and a home can't be asked about for a
  // Service one of them would overlap
  const open = client.quotes.filter(
    (q) => q.status === "requested" || q.status === "sent",
  );

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        trail={[
          { label: "Home", href: linkTo({ to: "/portal" }) },
          { label: "Request a Quote" },
        ]}
      />
      <Heading level={1}>Request a Quote</Heading>
      {open.length > 0 && (
        <Notice tone="info">
          {open.map((quote) => (
            <p key={quote.id}>
              {quote.status === "sent"
                ? "We've sent your Quote for "
                : "We're preparing your Quote for "}
              <Link
                href={linkTo({
                  to: "/portal/quotes/$quoteId",
                  params: { quoteId: quote.id },
                })}
              >
                {addressOf(quote.property)}
              </Link>
              .
            </p>
          ))}
        </Notice>
      )}
      <Card>
        <QuoteRequestForm
          headingLevel={2}
          asker={{
            kind: "client",
            properties: client.properties,
            open: open.map((q) => ({
              propertyId: q.property.id,
              serviceKey: q.service.key,
              kind: q.kind,
            })),
            businessName: client.businessName,
          }}
          onSubmitted={async (receipt) => {
            showToast({
              tone: "success",
              title: "Quote requested",
              description: `We'll email your Quote to ${receipt.emailedTo}.`,
            });
            await router.invalidate();
            await navigate({ to: "/portal" });
          }}
        />
      </Card>
    </div>
  );
}
