import { useEffect, useState } from "react";
import type { QuoteAskReceipt } from "@empire-cleaning/models";
import { QuoteRequestForm } from "@empire-cleaning/quote-request";
import { Notice } from "@empire-cleaning/ui";
import { business } from "../business.ts";

// the Guest Request a Quote form (#3, ADR-0005). Its first step is drawn into
// the page at build time, its tiles blank until the Services arrive, so the
// page doesn't jump as it loads; until it has, it can't be used (inert). With
// JavaScript off it never could be, so the section offers the phone number
// instead.
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
  useEffect(() => setReady(true), []);

  if (receipt) {
    return (
      <Notice tone="success">
        <p className="font-semibold">Thanks, we've got your request</p>
        <p>
          We'll email your Quote to {receipt.emailedTo}, usually within a
          working day.
        </p>
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
          onSubmitted={setReceipt}
        />
      </div>
      <p className="hidden text-center text-fg-muted [@media(scripting:none)]:block">
        Call us on{" "}
        <a href={business.phone.href} className="font-semibold text-fg">
          {business.phone.display}
        </a>{" "}
        and we'll put your Quote together.
      </p>
    </>
  );
}
