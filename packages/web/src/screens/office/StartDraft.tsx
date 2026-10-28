import { useState } from "react";
import { Repeat } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { OfficeQuote, QuoteKind } from "@empire-cleaning/models";
import { Button, Notice } from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";

// what a Draft is started for: a Quote's next Revision (its first setting
// its kind), or a home offered a Service Plan unprompted (ADR-0011,
// ADR-0017)
export type DraftTarget =
  | { quoteId: string; kind: QuoteKind }
  | { propertyId: string; kind: "service_plan" };

// Starts a Draft (or finds the Revision already being drafted) and opens it;
// says why if it can't
export function useStartDraft() {
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string>();
  const [starting, setStarting] = useState<DraftTarget>();

  const start = async (target: DraftTarget) => {
    setStarting(target);
    setFailure(undefined);
    try {
      const quote = await ("quoteId" in target
        ? postJson<OfficeQuote>(`/api/quotes/${target.quoteId}/revisions`, {
            kind: target.kind,
          })
        : postJson<OfficeQuote>("/api/quotes", target));
      await navigate({
        to: "/office/quotes/$quoteId",
        params: { quoteId: quote.id },
      });
    } catch (e) {
      setFailure(
        e instanceof ApiError && e.status === 409
          ? e.message
          : "The Draft couldn't be started. Please try again.",
      );
      setStarting(undefined);
    }
  };

  return { start, starting, failure };
}

// offers a home a Service Plan, unprompted, once its First Clean is
// Completed; or, for a home with a plan, new terms for it, which accepting
// changes the plan to
export function OfferServicePlan({
  propertyId,
  label = "Quote a Service Plan",
  primary = false,
}: {
  propertyId: string;
  label?: string;
  // as the one thing to do, e.g. on an empty Service Plan Tab
  primary?: boolean;
}) {
  const { start, starting, failure } = useStartDraft();
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={primary ? "primary" : "text"}
        size={primary ? "md" : "sm"}
        isPending={starting !== undefined}
        onPress={() => void start({ propertyId, kind: "service_plan" })}
      >
        <Repeat aria-hidden size={primary ? 18 : 16} />
        {label}
      </Button>
      {failure && <Notice tone="danger">{failure}</Notice>}
    </div>
  );
}
