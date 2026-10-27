import { useEffect, useState } from "react";
import type { QuoteAskReceipt } from "@empire-cleaning/models";
import { QuoteRequestForm } from "@empire-cleaning/quote-request";
import { Notice } from "@empire-cleaning/ui";
import { business } from "../business.ts";

// the Guest Quote Request form (#3, ADR-0005). Until it has loaded, and if
// JavaScript is off, the section offers the phone number instead of a form
// that couldn't send anything.
export function QuoteForm({ apiUrl }: { apiUrl: string }) {
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

  if (!ready) {
    return (
      <p className="text-fg-muted">
        Call us on{" "}
        <a href={business.phone.href} className="font-semibold text-fg">
          {business.phone.display}
        </a>{" "}
        and we'll put your Quote together.
      </p>
    );
  }

  return (
    <div className="max-w-2xl">
      <QuoteRequestForm
        asker={{ kind: "guest" }}
        apiUrl={apiUrl}
        onSubmitted={setReceipt}
      />
    </div>
  );
}
