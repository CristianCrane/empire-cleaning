import { useState, type ReactNode } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { CalendarX } from "lucide-react";
import {
  parseDate,
  parseTime,
  type CalendarDate,
  type Time,
} from "@internationalized/date";
import type { OfficeServicePlan, UnplacedVisit } from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  DatePicker,
  Dialog,
  Heading,
  IconTile,
  Link,
  List,
  ListItem,
  Notice,
  Section,
  StatusBadge,
  TimeField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  clientName,
  dayOfInstant,
  formatDateTime,
  formatDay,
  timeOfDay,
  weekdayOf,
} from "../format.ts";
import { EndPlan, OnHold, PlanFacts, PlanStatusBadge } from "../PlanParts.tsx";
import { useAction } from "../action.ts";
import { homeCrumbs, JobStatusBadge } from "./PropertyScreen.tsx";
import { PickFromSchedule } from "./SchedulePicker.tsx";
import { OfferServicePlan } from "./StartDraft.tsx";

// an Ended Service Plan, on a page of its own: a current one is on its
// home's page
export function ServicePlanScreen() {
  const plan = useLoaderData({ from: "/office/service-plans/$planId" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            ...homeCrumbs(plan.client, plan.property),
            { label: "Service Plan" },
          ]}
        />
        <Heading level={1}>Service Plan</Heading>
        <p className="text-fg-muted">
          {clientName(plan.client)} · {addressOf(plan.property)}
        </p>
      </div>
      <PlanDetails plan={plan} />
      <PlanJobs plan={plan} />
    </div>
  );
}

// how the Client pays for the plan's cleans: each when it's done, or on a
// weekly Bill (ADR-0016)
const paymentLine = {
  per_clean: "Each clean is charged to the Client's saved card when it's done.",
  automatic:
    "Each week's cleans go on one Bill, made the following Monday and charged to the Client's saved Payment Method.",
  on_page:
    "Each week's cleans go on one Bill, made the following Monday, which the Client pays on its page by its due date.",
};

// A Service Plan for the Office, as its Client reads it (UX pass, #96): why
// it's On Hold, if it is; the dates it came round with no room, to book at
// another time agreed with the Client or skip; then when, large, and its
// facts across, with the way to change its terms; and Ending it for the
// Client. Its Jobs are in its home's History
export function PlanDetails({
  plan,
  changeTerms = plan.status !== "ended" && (
    <OfferServicePlan propertyId={plan.property.id} label="Change terms" />
  ),
}: {
  plan: OfficeServicePlan;
  // how its terms change: a new Service Plan Quote
  changeTerms?: ReactNode;
}) {
  return (
    <>
      <OnHold
        plan={plan}
        forClient={false}
        jobHref={(jobId) =>
          linkTo({ to: "/office/jobs/$jobId", params: { jobId } })
        }
        billHref={(billId) =>
          linkTo({ to: "/office/bills/$billId", params: { billId } })
        }
      />

      {plan.unplaced.length > 0 && <WaitingVisits plan={plan} />}

      <Section title="Service Plan" actions={changeTerms}>
        <Card>
          <PlanFacts
            plan={plan}
            forClient={false}
            badge={<PlanStatusBadge status={plan.status} />}
          />
          <p className="border-t border-border pt-4 text-sm text-fg-muted">
            {paymentLine[plan.weeklyBill ?? "per_clean"]}{" "}
            <Link
              href={linkTo({
                to: "/office/quotes/$quoteId",
                params: { quoteId: plan.quoteId },
              })}
            >
              Its Service Plan Quote
            </Link>
          </p>
        </Card>
      </Section>

      <EndPlan
        plan={plan}
        forClient={false}
        endPath={`/api/service-plans/${plan.id}/end`}
      />
    </>
  );
}

// every Job the plan booked, opening each: on an Ended plan's page. A
// current plan's are in its home's History
function PlanJobs({ plan }: { plan: OfficeServicePlan }) {
  const navigate = useNavigate();
  return (
    <Section title="Jobs">
      <List
        aria-label="The plan's Jobs"
        renderEmptyState={() => (
          <p className="p-4 text-center text-fg-muted">No Jobs yet.</p>
        )}
      >
        {plan.jobs.map((job) => (
          <ListItem
            key={job.id}
            id={job.id}
            title={formatDateTime(job.startsAt)}
            description={
              job.crew.length > 0
                ? job.crew.map((c) => c.name).join(", ")
                : "Nobody Offered yet"
            }
            end={
              job.status === "booked" ? (
                <StatusBadge
                  tone={job.assignment === "assigned" ? "success" : "warning"}
                >
                  {job.assignment === "assigned" ? "Assigned" : "Unassigned"}
                </StatusBadge>
              ) : (
                <JobStatusBadge status={job.status} />
              )
            }
            onAction={() =>
              void navigate({
                to: "/office/jobs/$jobId",
                params: { jobId: job.id },
              })
            }
          />
        ))}
      </List>
    </Section>
  );
}

type VisitProps = { plan: OfficeServicePlan; visit: UnplacedVisit };

const visitPath = ({ plan, visit }: VisitProps) =>
  `/api/service-plans/${plan.id}/visits/${visit.id}`;

// the dates it came round with no room, as to-do rows: each opens the one
// dialog that books it or skips it
function WaitingVisits({ plan }: { plan: OfficeServicePlan }) {
  const [open, setOpen] = useState<UnplacedVisit>();
  return (
    <Section
      title="Waiting to be booked"
      description="These dates came round with no room on the Schedule, so nothing was booked. Agree another time with the Client, or skip the visit."
    >
      <List
        aria-label="Visits waiting to be booked"
        onAction={(id) => setOpen(plan.unplaced.find((v) => v.id === id))}
      >
        {plan.unplaced.map((visit) => (
          <ListItem
            key={visit.id}
            id={visit.id}
            start={<IconTile icon={CalendarX} tone="warning" />}
            title={`Book the ${formatDay(visit.dueOn)} visit`}
            description="No room that day: book it, or skip it"
          />
        ))}
      </List>
      {open && (
        <Dialog
          title={`Book the ${formatDay(open.dueOn)} visit`}
          size="wide"
          isOpen
          onOpenChange={(isOpen) => !isOpen && setOpen(undefined)}
        >
          {({ close }) => <BookOrSkip plan={plan} visit={open} close={close} />}
        </Dialog>
      )}
    </Section>
  );
}

// books the visit at a time agreed with the Client, as a plan Job; or skips
// it, booking nothing
function BookOrSkip({
  plan,
  visit,
  close,
}: VisitProps & { close: () => void }) {
  // the weekday it came round on: its usual time, and its visit
  const day =
    plan.days.find(
      (d) => weekdayOf(dayOfInstant(d.startsAt)) === weekdayOf(visit.dueOn),
    ) ?? plan.days[0]!;
  const usual = timeOfDay(day.startsAt);
  const [date, setDate] = useState<CalendarDate | null>(parseDate(visit.dueOn));
  const [time, setTime] = useState<Time | null>(parseTime(usual));
  const booking = useAction("The visit wasn't booked. Please try again.");
  const skipping = useAction("The visit wasn't skipped. Please try again.");
  const problem = booking.problem ?? skipping.problem;
  const at = date &&
    time && {
      date: date.toString(),
      time: time.toString().slice(0, 5),
    };

  const book = async () => {
    if (
      await booking.run(
        () => postJson(`${visitPath({ plan, visit })}/book`, at),
        "Visit booked",
      )
    )
      close();
  };
  const skip = async () => {
    if (
      await skipping.run(
        () => postJson(`${visitPath({ plan, visit })}/skip`),
        "Visit skipped",
      )
    )
      close();
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <DatePicker label="Day" value={date} onChange={setDate} />
        <TimeField
          label="Start time"
          description="New York time."
          value={time}
          onChange={setTime}
        />
      </div>
      <PickFromSchedule
        date={date?.toString()}
        time={time?.toString().slice(0, 5)}
        hoursOnSite={day.hoursOnSite}
        crew={{ crewSize: day.crewSize }}
        inline
        onPick={(picked) => {
          setDate(parseDate(picked.date));
          setTime(parseTime(picked.time));
        }}
      />
      <p className="text-sm text-fg-muted">
        It's booked as the plan's Job, at its price, and Offered to the crew of
        the plan's Job before it. The plan's later Jobs stay on their usual day.
        Skipping it books nothing, and the plan carries on from its next date:
        let the Client know.
      </p>
      {problem && <Notice tone="danger">{problem}</Notice>}
      <Actions>
        <Button
          variant="quiet"
          isPending={skipping.isPending}
          onPress={() => void skip()}
        >
          Skip visit
        </Button>
        <Button
          isPending={booking.isPending}
          isDisabled={!at}
          onPress={() => void book()}
        >
          Book visit
        </Button>
      </Actions>
    </>
  );
}
