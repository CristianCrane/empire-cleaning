import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { QuoteRequestForm } from "@empire-cleaning/quote-request";
import {
  Breadcrumbs,
  Card,
  Heading,
  Link,
  Notice,
  showToast,
  useLanguage,
} from "@empire-cleaning/ui";
import { catalog, messages } from "@empire-cleaning/models";
import { linkTo } from "../../links.ts";
import { addressOf } from "../format.ts";
import { quoteRequested } from "../QuoteParts.tsx";
import { portalWords } from "./words.ts";

const words = catalog({
  en: {
    sentFor: "We've already sent you a quote for ",
    workingOn: "We're working on your quote for ",
  },
  es: {
    sentFor: "Ya le enviamos una cotización para ",
    workingOn: "Estamos preparando su cotización para ",
  },
});

// a signed-in Client asking about a new home or one of theirs
export function PortalRequest() {
  const client = useLoaderData({ from: "/portal/request" });
  const navigate = useNavigate();
  const router = useRouter();
  const lang = useLanguage();
  const w = words[lang];
  const { REQUEST_A_QUOTE } = messages[lang];
  // their open Quotes are pointed to, and a home can't be asked about for a
  // Service one of them would overlap
  const open = client.quotes.filter(
    (q) => q.status === "requested" || q.status === "sent",
  );

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        trail={[
          { label: portalWords[lang].home, href: linkTo({ to: "/portal" }) },
          { label: REQUEST_A_QUOTE },
        ]}
      />
      <Heading level={1}>{REQUEST_A_QUOTE}</Heading>
      {open.length > 0 && (
        <Notice tone="info">
          {open.map((quote) => (
            <p key={quote.id}>
              {quote.status === "sent" ? w.sentFor : w.workingOn}
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
            showToast(quoteRequested(lang, receipt.emailedTo));
            await router.invalidate();
            await navigate({ to: "/portal" });
          }}
        />
      </Card>
    </div>
  );
}
