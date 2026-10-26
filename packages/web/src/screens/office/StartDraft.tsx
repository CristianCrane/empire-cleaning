import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { OfficeQuote, QuoteKind } from "@empire-cleaning/models";
import { Button, Notice } from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";

// what a Draft is started for: a Quote Request, answered with either kind
// of Quote, or a home offered a Service Plan unprompted (ADR-0011)
export type DraftTarget =
  | { quoteRequestId: string; kind: QuoteKind }
  | { propertyId: string; kind: "service_plan" };

// Starts a Draft (or finds the one already started) and opens it; says why
// if it can't
export function useStartDraft() {
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string>();
  const [starting, setStarting] = useState<DraftTarget>();

  const start = async (target: DraftTarget) => {
    setStarting(target);
    setFailure(undefined);
    try {
      const quote = await postJson<OfficeQuote>("/api/quotes", target);
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
// Completed
export function OfferServicePlan({ propertyId }: { propertyId: string }) {
  const { start, starting, failure } = useStartDraft();
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        isPending={starting !== undefined}
        onPress={() => void start({ propertyId, kind: "service_plan" })}
      >
        Offer a Service Plan
      </Button>
      {failure && <Notice tone="danger">{failure}</Notice>}
    </div>
  );
}
