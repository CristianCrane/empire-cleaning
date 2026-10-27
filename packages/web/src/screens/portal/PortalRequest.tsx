import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { QuoteRequestForm } from "@empire-cleaning/quote-request";
import { Breadcrumbs, Card, Heading, showToast } from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";

// a signed-in Client asking about a new home or one of theirs
export function PortalRequest() {
  const client = useLoaderData({ from: "/portal/request" });
  const navigate = useNavigate();
  const router = useRouter();
  // until Quotes can end a request, every request is still waiting
  const waiting = client.quoteRequests.map((r) => r.propertyId);

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        trail={[
          { label: "Home", href: linkTo({ to: "/portal" }) },
          { label: "Request a Quote" },
        ]}
      />
      <Heading level={1}>Request a Quote</Heading>
      <Card>
        <QuoteRequestForm
          headingLevel={2}
          asker={{
            kind: "client",
            properties: client.properties,
            waiting,
            businessName: client.businessName,
          }}
          onSubmitted={async (receipt) => {
            showToast({
              tone: "success",
              title: "Quote Request sent",
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
