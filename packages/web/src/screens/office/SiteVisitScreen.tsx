import type { ReactNode } from "react";
import { useLoaderData } from "@tanstack/react-router";
import type {
  OfficeSiteVisit,
  PremisesTypeChoice,
} from "@empire-cleaning/models";
import {
  Breadcrumbs,
  Card,
  Heading,
  Link,
  Notice,
  Section,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import {
  clientName,
  conditionText,
  addressOf,
  formatDateTime,
  formatMinutes,
} from "../format.ts";
import { homeCrumbs } from "./PropertyScreen.tsx";
import {
  CancelSiteVisit,
  MoveSiteVisit,
  RecordFindings,
  SiteVisitBadge,
} from "./SiteVisitParts.tsx";

// an earlier or cancelled Site Visit, on a page of its own: a home's
// current one is on its Site Visit Tab
export function SiteVisitScreen() {
  const { visit, premisesTypes } = useLoaderData({
    from: "/office/site-visits/$visitId",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            ...homeCrumbs(visit.client, visit.property),
            { label: "Site Visit" },
          ]}
        />
        <div className="flex flex-col gap-1">
          <Heading level={1}>Site Visit</Heading>
          <p className="text-fg-muted">
            {clientName(visit.client)} · {addressOf(visit.property)}
          </p>
        </div>
      </div>
      <VisitDetails visit={visit} premisesTypes={premisesTypes} />
    </div>
  );
}

// One Site Visit for the Office (ADR-0015): when, who and for how long, and
// once someone has been, what they found: a booked one has its findings
// recorded, and can be moved or cancelled. It's free, so there's nothing
// to charge; the Client calls to change it.
export function VisitDetails({
  visit,
  premisesTypes,
  actions,
}: {
  visit: OfficeSiteVisit;
  premisesTypes: PremisesTypeChoice[];
  // more to do beside it, e.g. booking another
  actions?: ReactNode;
}) {
  const booked = visit.status === "booked";
  const found = visit.status === "done";

  return (
    <div className="flex flex-col gap-6">
      <Section
        title={
          visit.startsAt
            ? formatDateTime(visit.startsAt)
            : "Findings recorded, with no visit"
        }
        actions={
          (booked || actions) && (
            <>
              {booked && <MoveSiteVisit visit={visit} />}
              {booked && <CancelSiteVisit visit={visit} />}
              {actions}
            </>
          )
        }
      >
        <Card>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="font-semibold">Status</dt>
            <dd>
              <SiteVisitBadge status={visit.status} />
            </dd>
            {visit.quoteId && (
              <>
                <dt className="font-semibold">Quote</dt>
                <dd>
                  <Link
                    href={linkTo({
                      to: "/office/quotes/$quoteId",
                      params: { quoteId: visit.quoteId },
                    })}
                  >
                    The Quote it's for
                  </Link>
                </dd>
              </>
            )}
            {visit.startsAt && (
              <>
                <dt className="font-semibold">Duration</dt>
                <dd>{formatMinutes(visit.minutes)}</dd>
                <dt className="font-semibold">Who visits</dt>
                <dd>{visit.visitor?.name}</dd>
              </>
            )}
            {visit.cancelledAt && (
              <>
                <dt className="font-semibold">Cancelled</dt>
                <dd>{formatDateTime(visit.cancelledAt)}</dd>
              </>
            )}
          </dl>
          {visit.status === "cancelled" && (
            <Notice>
              <p>This visit was cancelled, so nothing was recorded.</p>
            </Notice>
          )}
        </Card>
      </Section>

      {(booked || found) && (
        <Section title="Findings">
          <Card>
            {booked ? (
              // one row, the button kept right; it wraps under at phone width
              <div className="flex flex-wrap items-center gap-3">
                <p className="min-w-0 grow basis-64 text-fg-muted">
                  When it's done, record what was found: it updates the{" "}
                  {visit.property.kind === "commercial"
                    ? "premises'"
                    : "home's"}{" "}
                  details, and a Quote can be sent.
                </p>
                <div className="ml-auto">
                  <RecordFindings visit={visit} premisesTypes={premisesTypes} />
                </div>
              </div>
            ) : (
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold">Recorded</dt>
                <dd>{formatDateTime(visit.doneAt!)}</dd>
                <dt className="font-semibold">Condition</dt>
                <dd>{conditionText(visit.property.condition)}</dd>
                <dt className="font-semibold">Office notes</dt>
                <dd className="whitespace-pre-line">
                  {visit.officeNotes || "None"}
                </dd>
              </dl>
            )}
          </Card>
        </Section>
      )}
    </div>
  );
}
