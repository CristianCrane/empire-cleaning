import { formats } from "@empire-cleaning/models";
import { useLoaderData } from "@tanstack/react-router";
import {
  CalendarCheck,
  ClipboardCheck,
  Clock,
  NotebookPen,
  UserRound,
  CalendarClock,
  CalendarX,
} from "lucide-react";
import type {
  OfficeSiteVisit,
  PremisesTypeChoice,
} from "@empire-cleaning/models";
import {
  ActionRow,
  Card,
  DateTile,
  IconTile,
  Link,
  Section,
  Fact,
  RecordPage,
  DetailsCard,
  Facts,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  dayOfInstant,
  formatMinutes,
  screenWords,
} from "../format.ts";
import { AccessFact, ConditionFact } from "../Fact.tsx";
import { homeIcon, QuoteIcon, SiteVisitIcon } from "../icons.ts";
import { homeTrail } from "./trails.ts";
import {
  CancelSiteVisit,
  MoveSiteVisit,
  RECORD_FINDINGS,
  RecordFindings,
  RecordFindingsDialog,
  hasBeen,
  SiteVisitBadge,
} from "./SiteVisitParts.tsx";

const { propertySummary } = screenWords.en;

const { formatDateTime, formatDay, formatTime } = formats.en;

// One Site Visit for the Office (ADR-0015), a Record (docs/ux.md): when,
// large, behind a date tile; who, how long, how to get in and the Quote
// it's for; then what it found. Once it's been, recording that is the
// page's next step; before, it waits on What it found. A booked one is
// moved or cancelled from the page's actions. It's free, so there's nothing
// to charge; the Client calls to change it. A home's page shows its current
// one as a row opening it
export function SiteVisitScreen() {
  const { visit, premisesTypes } = useLoaderData({
    from: "/office/site-visits/$visitId",
  });
  const booked = visit.status === "booked";
  const premises = visit.property.kind === "commercial";
  const been = hasBeen(visit);

  return (
    <RecordPage
      trail={[
        ...homeTrail(visit.client, visit.property),
        { label: "Site visit" },
      ]}
      title="Site visit"
      status={<SiteVisitBadge visit={visit} />}
      next={
        booked && been
          ? {
              label: RECORD_FINDINGS,
              icon: ClipboardCheck,
              dialog: (state) => (
                <RecordFindingsDialog
                  visit={visit}
                  premisesTypes={premisesTypes}
                  {...state}
                />
              ),
            }
          : undefined
      }
      actions={[
        booked && {
          label: "Move or change",
          icon: CalendarClock,
          dialog: (state) => <MoveSiteVisit visit={visit} {...state} />,
        },
        booked && {
          label: "Cancel visit",
          icon: CalendarX,
          danger: true,
          dialog: (state) => <CancelSiteVisit visit={visit} {...state} />,
        },
      ]}
      alerts={[
        been && {
          key: "been",
          tone: "warning",
          children: `${visit.visitor?.name ?? "The visitor"} has been. A quote waits on what they found.`,
        },
        visit.status === "cancelled" && {
          key: "cancelled",
          children: `Cancelled ${formatDateTime(visit.cancelledAt!)}. Book another from the ${premises ? "business's" : "home's"} page.`,
        },
      ]}
      details={
        <DetailsCard
          label="Visit details"
          tile={
            visit.startsAt ? (
              <DateTile date={visit.startsAt} />
            ) : (
              <IconTile icon={SiteVisitIcon} size="lg" />
            )
          }
          kicker={premises ? "A business" : "A home"}
          title={
            visit.startsAt
              ? `${formatDay(dayOfInstant(visit.startsAt))} at ${formatTime(visit.startsAt)}`
              : "Findings recorded, with no visit"
          }
          line={addressOf(visit.property)}
        >
          <Facts>
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
            <AccessFact property={visit.property} />
            {visit.quoteId && (
              <Fact
                icon={QuoteIcon}
                label="The quote it's for"
                value={
                  <Link
                    href={linkTo({
                      to: "/office/quotes/$quoteId",
                      params: { quoteId: visit.quoteId },
                    })}
                  >
                    Open the quote
                  </Link>
                }
              />
            )}
          </Facts>
        </DetailsCard>
      }
    >
      <Found visit={visit} premisesTypes={premisesTypes} been={been} />
    </RecordPage>
  );
}

// what it found; or, booked and not been yet, the way to record it, an
// empty part offering its action. Once it's been, recording is the page's
// next step, so the part waits until there's something found
function Found({
  visit,
  premisesTypes,
  been,
}: {
  visit: OfficeSiteVisit;
  premisesTypes: PremisesTypeChoice[];
  been: boolean;
}) {
  if (visit.status === "cancelled") return null;
  if (visit.status === "booked" && been) return null;
  return (
    <Section title="What it found">
      <Card>
        {visit.status === "booked" ? (
          <ActionRow
            actions={
              <RecordFindings visit={visit} premisesTypes={premisesTypes} />
            }
          >
            <p>
              When it's done, add what was found. It updates the{" "}
              {visit.property.kind === "commercial" ? "business's" : "home's"}{" "}
              details so you can send a quote.
            </p>
          </ActionRow>
        ) : (
          <Facts>
            <Fact
              icon={homeIcon(visit.property.kind)}
              label="What it is"
              value={propertySummary(visit.property)}
            />
            <ConditionFact property={visit.property} />
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
              className="col-span-full"
            />
          </Facts>
        )}
      </Card>
    </Section>
  );
}
