import { useEffect, useState } from "react";
import { type QuoteAskReceipt, messages } from "@empire-cleaning/models";
import { QuoteRequestForm } from "@empire-cleaning/quote-request";
import { Notice } from "@empire-cleaning/ui";
import { business } from "../business.ts";
import { keepCampaign, quoteSource } from "../source.ts";

const { quoteEmailedTo } = messages.en;

// the Guest Request a Quote form (#3, ADR-0005). Its first step is drawn into
// the page at build time, its tiles blank until the Services arrive, so the
// page doesn't jump as it loads; until it has, it can't be used (inert). With
// JavaScript off it never could be, so the section offers the phone number
// instead. Every page with content has it, so it keeps the campaign tags
// of the link a visit began with, and sends them and the page with the
// request (#185). Its errors are reported to Sentry, which every page starts
// (src/monitoring.ts).
export function QuoteForm({
  apiUrl,
  start,
}: {
  apiUrl: string;
  // a service page's Service, chosen to start with (#177)
  start?: { serviceKey: string; regular?: boolean };
}) {
  const [ready, setReady] = useState(false);
  const [receipt, setReceipt] = useState<QuoteAskReceipt>();
  useEffect(() => {
    keepCampaign();
    setReady(true);
  }, []);

  if (receipt) {
    return (
      <Notice tone="success">
        <p className="font-semibold">Thanks, we've got your request</p>
        <p>{quoteEmailedTo(receipt.emailedTo)}</p>
      </Notice>
    );
  }

  return (
    <>
      <div inert={!ready} className="[@media(scripting:none)]:hidden">
        <QuoteRequestForm
          asker={{ kind: "guest" }}
          apiUrl={apiUrl}
          start={start}
          source={quoteSource}
          onSubmitted={setReceipt}
        />
      </div>
      <p className="hidden text-center text-fg-muted [@media(scripting:none)]:block">
        Call us on{" "}
        <a href={business.phone.href} className="font-semibold text-fg">
          {business.phone.display}
        </a>{" "}
        and we'll put your quote together.
      </p>
    </>
  );
}
