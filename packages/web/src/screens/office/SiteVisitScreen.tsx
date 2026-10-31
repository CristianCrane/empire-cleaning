import { useLoaderData } from "@tanstack/react-router";
import {
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Clock,
  House,
  KeyRound,
  NotebookPen,
  Sparkles,
  UserRound,
} from "lucide-react";
import type {
  OfficeSiteVisit,
  PremisesTypeChoice,
} from "@empire-cleaning/models";
import {
  ActionRow,
  Breadcrumbs,
  Card,
  DateTile,
  Heading,
  IconTile,
  Link,
  Notice,
  Section,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  clientName,
  conditionText,
  dayOfInstant,
  formatDateTime,
  formatMinutes,
  formatDay,
  propertySummary,
  formatTime,
} from "../format.ts";
import { Fact } from "../Fact.tsx";
import { QuoteIcon } from "../icons.ts";
import { homeCrumbs } from "./PropertyScreen.tsx";
import {
  CancelSiteVisit,
  MoveSiteVisit,
  RecordFindings,
  SiteVisitBadge,
} from "./SiteVisitParts.tsx";

// One Site Visit for the Office (ADR-0015), on a page of its own: a home's
// page shows its current one as a row opening it
export function SiteVisitScreen() {
  const { visit, premisesTypes } = useLoaderData({
    from: "/office/site-visits/$visitId",
  });
  // it has been, with nothing recorded yet: recording is what's next
  const been =
    visit.status === "booked" &&
    visit.startsAt !== null &&
    new Date(visit.startsAt).getTime() < Date.now();

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
          <div className="flex flex-wrap items-center gap-3">
            <Heading level={1}>Site Visit</Heading>
            <SiteVisitBadge status={visit.status} />
          </div>
          <p className="text-fg-muted">
            {clientName(visit.client)} · {addressOf(visit.property)}
          </p>
        </div>
      </div>
      {been && (
        <Notice tone="warning">
          {visit.visitor?.name ?? "The visitor"} has been: record what was
          found, so a Quote can be sent.
        </Notice>
      )}
      {visit.status === "cancelled" && (
        <Notice>
          Cancelled {formatDateTime(visit.cancelledAt!)}, so nothing was
          recorded. Another can be booked from the{" "}
          {visit.property.kind === "commercial" ? "premises'" : "home's"} page.
        </Notice>
      )}
      <VisitDetails visit={visit} premisesTypes={premisesTypes} been={been} />
    </div>
  );
}

// The visit as one record (UX pass, #96): when, large, behind a date tile;
// who, how long, how to get in and the Quote it's for, across; then what it
// found, or the way to record it, at its foot. A booked one is moved or
// cancelled from its header. It's free, so there's nothing to charge; the
// Client calls to change it.
function VisitDetails({
  visit,
  premisesTypes,
  been,
}: {
  visit: OfficeSiteVisit;
  premisesTypes: PremisesTypeChoice[];
  been: boolean;
}) {
  const booked = visit.status === "booked";
  const premises = visit.property.kind === "commercial";

  return (
    <Section
      title="Visit details"
      actions={
        booked && (
          <>
            <MoveSiteVisit visit={visit} />
            <CancelSiteVisit visit={visit} />
          </>
        )
      }
    >
      <Card>
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            {visit.startsAt ? (
              <DateTile date={visit.startsAt} />
            ) : (
              <IconTile icon={ClipboardCheck} size="lg" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm text-fg-muted">
                {premises ? "Business premises" : "A home"}
              </p>
              <p className="text-xl font-semibold text-fg">
                {visit.startsAt
                  ? `${formatDay(dayOfInstant(visit.startsAt))} at ${formatTime(visit.startsAt)}`
                  : "Findings recorded, with no visit"}
              </p>
              <p className="text-fg-muted">{addressOf(visit.property)}</p>
            </div>
          </div>
          <div className="@container">
            <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
              {visit.visitor && (
                <Fact
                  icon={UserRound}
                  label="Who visits"
                  value={visit.visitor.name}
                />
              )}
              {visit.startsAt && (
                <Fact
                  icon={Clock}
                  label="How long"
                  value={formatMinutes(visit.minutes)}
                  line="Booked for"
                />
              )}
              <Fact
                icon={KeyRound}
                label="How we get in"
                value={
                  <span className="whitespace-pre-line">
                    {visit.property.accessInstructions || "Not added yet"}
                  </span>
                }
              />
              {visit.quoteId && (
                <Fact
                  icon={QuoteIcon}
                  label="The Quote it's for"
                  value={
                    <Link
                      href={linkTo({
                        to: "/office/quotes/$quoteId",
                        params: { quoteId: visit.quoteId },
                      })}
                    >
                      Open the Quote
                    </Link>
                  }
                />
              )}
            </dl>
          </div>
          {booked && (
            <div className="border-t border-border pt-6">
              <ActionRow
                actions={
                  <RecordFindings
                    visit={visit}
                    premisesTypes={premisesTypes}
                    primary={been}
                  />
                }
              >
                <p>
                  When it's done, record what was found: it updates the{" "}
                  {premises ? "premises'" : "home's"} details, and a Quote can
                  be sent.
                </p>
              </ActionRow>
            </div>
          )}
          {visit.status === "done" && (
            <div className="flex flex-col gap-4 border-t border-border pt-6">
              <p className="font-semibold text-fg">What it found</p>
              <div className="@container">
                <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
                  <Fact
                    icon={premises ? Building2 : House}
                    label="What it is"
                    value={propertySummary(visit.property)}
                    className="@3xl:col-span-2"
                  />
                  <Fact
                    icon={Sparkles}
                    label="Condition"
                    value={conditionText(visit.property.condition)}
                  />
                  <Fact
                    icon={CalendarCheck}
                    label="Recorded"
                    value={formatDateTime(visit.doneAt!)}
                  />
                  <Fact
                    icon={NotebookPen}
                    label="Office notes"
                    value={
                      <span className="whitespace-pre-line">
                        {visit.officeNotes || "None"}
                      </span>
                    }
                    className="@md:col-span-2 @3xl:col-span-4"
                  />
                </dl>
              </div>
            </div>
          )}
        </div>
      </Card>
    </Section>
  );
}
