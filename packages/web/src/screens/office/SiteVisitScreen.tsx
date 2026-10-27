import { useLoaderData } from "@tanstack/react-router";
import { Breadcrumbs, Card, Heading, Notice } from "@empire-cleaning/ui";
import {
  addressOf,
  clientName,
  conditionText,
  formatDateTime,
  formatMinutes,
  propertySummary,
} from "../format.ts";
import { homeCrumbs } from "./PropertyScreen.tsx";
import {
  CancelSiteVisit,
  MoveSiteVisit,
  RecordFindings,
  SiteVisitBadge,
} from "./SiteVisitParts.tsx";

// One Site Visit for the Office (ADR-0015): when, who and for how long, and
// once someone has been, what they found. It's free, so there's nothing to
// charge; the Client calls to change it.
export function SiteVisitScreen() {
  const { visit, premisesTypes } = useLoaderData({
    from: "/office/site-visits/$visitId",
  });
  const { property } = visit;
  const booked = visit.status === "booked";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            ...homeCrumbs(visit.client, property),
            { label: "Site Visit" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>Site Visit</Heading>
          <SiteVisitBadge status={visit.status} />
        </div>
      </div>

      <Card title={addressOf(property)} description={clientName(visit.client)}>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">When</dt>
          <dd>
            {visit.startsAt
              ? formatDateTime(visit.startsAt)
              : "No visit: findings recorded from what the Office knew"}
          </dd>
          {visit.startsAt && (
            <>
              <dt className="font-semibold">Length</dt>
              <dd>{formatMinutes(visit.minutes)}</dd>
              <dt className="font-semibold">Who visits</dt>
              <dd>{visit.visitor?.name}</dd>
            </>
          )}
          {visit.doneAt && (
            <>
              <dt className="font-semibold">Findings recorded</dt>
              <dd>{formatDateTime(visit.doneAt)}</dd>
            </>
          )}
          {visit.cancelledAt && (
            <>
              <dt className="font-semibold">Cancelled</dt>
              <dd>{formatDateTime(visit.cancelledAt)}</dd>
            </>
          )}
        </dl>
        {/* in the body, not the header, so they wrap at phone width */}
        {booked && (
          <div className="flex flex-wrap gap-2">
            <RecordFindings visit={visit} premisesTypes={premisesTypes} />
            <MoveSiteVisit visit={visit} />
            <CancelSiteVisit visit={visit} />
          </div>
        )}
        {booked && (
          <p className="text-sm text-fg-muted">
            When it's done, record what was found: it updates the{" "}
            {property.kind === "commercial" ? "premises'" : "home's"} details,
            and a Quote can be sent.
          </p>
        )}
      </Card>

      <Card title="As recorded now" description={propertySummary(property)}>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Condition</dt>
          <dd>{conditionText(property.condition)}</dd>
          <dt className="font-semibold">Office notes</dt>
          <dd className="whitespace-pre-line">{visit.officeNotes || "None"}</dd>
        </dl>
        {visit.status === "cancelled" && (
          <Notice>This visit was cancelled, so nothing was recorded.</Notice>
        )}
      </Card>
    </div>
  );
}
