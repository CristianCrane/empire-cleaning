import { useState, type ReactNode } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
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
  DialogTrigger,
  Heading,
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
  planName,
  timeOfDay,
  weekdayOf,
} from "../format.ts";
import { EndPlan, OnHold, PlanStatusBadge, PlanTerms } from "../PlanParts.tsx";
import { useAction } from "../action.ts";
import { homeCrumbs, jobStatusLabel } from "./PropertyScreen.tsx";
import { PickFromSchedule } from "./SchedulePicker.tsx";
import { OfferServicePlan } from "./StartDraft.tsx";

// an Ended Service Plan, on a page of its own: a current one is on its
// home's Service Plan Tab
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
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>Service Plan</Heading>
          <PlanStatusBadge status={plan.status} />
        </div>
        <p className="text-fg-muted">
          {clientName(plan.client)} · {addressOf(plan.property)}
        </p>
      </div>
      <PlanDetails plan={plan} />
      <PlanJobs plan={plan} />
    </div>
  );
}

// a Service Plan for the Office: why it's On Hold, if it is; the dates it
// came round with no room, for Office Staff to book at another time they
// agree with the Client, or skip; its status, Quote and terms, with the way
// to change them;
// and Ending it for the Client. Its Jobs are in its home's History
export function PlanDetails({
  plan,
  changeTerms = plan.status !== "ended" && (
    <OfferServicePlan propertyId={plan.property.id} label="Change terms" />
  ),
  notice,
}: {
  plan: OfficeServicePlan;
  // how its terms change: a new Service Plan Quote
  changeTerms?: ReactNode;
  // what to know first, e.g. new terms waiting on the Client, as an info
  // Notice
  notice?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      {notice && <Notice>{notice}</Notice>}
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

      {plan.unplaced.length > 0 && (
        <Section
          title="Waiting to be booked"
          description="These dates came round with no room on the Schedule, so nothing was booked. Agree another time with the Client, or skip the visit."
        >
          <List aria-label="Visits waiting to be booked">
            {plan.unplaced.map((visit) => (
              <ListItem
                key={visit.id}
                id={visit.id}
                title={formatDay(visit.dueOn)}
                description="No room that day"
                end={
                  <div className="flex flex-wrap gap-2">
                    <BookVisit plan={plan} visit={visit} />
                    <SkipVisit plan={plan} visit={visit} />
                  </div>
                }
              />
            ))}
          </List>
        </Section>
      )}

      <Section title={planName(plan)} actions={changeTerms}>
        <Card>
          <PlanTerms
            plan={plan}
            lead={
              <>
                <dt className="font-semibold">Status</dt>
                <dd>
                  <PlanStatusBadge status={plan.status} />
                </dd>
                <dt className="font-semibold">Quote</dt>
                <dd>
                  <Link
                    href={linkTo({
                      to: "/office/quotes/$quoteId",
                      params: { quoteId: plan.quoteId },
                    })}
                  >
                    Its Service Plan Quote
                  </Link>
                </dd>
              </>
            }
          />
        </Card>
      </Section>

      <EndPlan
        plan={plan}
        forClient={false}
        endPath={`/api/service-plans/${plan.id}/end`}
      />
    </div>
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
                <StatusBadge>{jobStatusLabel[job.status]}</StatusBadge>
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

// books the visit at a time agreed with the Client, as a plan Job
function BookVisit(props: VisitProps) {
  return (
    <DialogTrigger>
      <Button>Book</Button>
      <Dialog title={`Book the ${formatDay(props.visit.dueOn)} visit`}>
        {({ close }) => <ChooseVisitTime {...props} close={close} />}
      </Dialog>
    </DialogTrigger>
  );
}

function ChooseVisitTime({
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
  const action = useAction("The visit wasn't booked. Please try again.");
  const at = date &&
    time && {
      date: date.toString(),
      time: time.toString().slice(0, 5),
    };

  const book = async () => {
    if (
      await action.run(
        () => postJson(`${visitPath({ plan, visit })}/book`, at),
        "Visit booked",
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
        onPick={(picked) => {
          setDate(parseDate(picked.date));
          setTime(parseTime(picked.time));
        }}
      />
      <p className="text-sm text-fg-muted">
        It's booked as the plan's Job, at its price, and Offered to the crew of
        the plan's Job before it. The plan's later Jobs stay on their usual day.
      </p>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="secondary" onPress={close}>
          Cancel
        </Button>
        <Button
          isPending={action.isPending}
          isDisabled={!at}
          onPress={() => void book()}
        >
          Book visit
        </Button>
      </Actions>
    </>
  );
}

// skips the visit: nothing is booked for it
function SkipVisit(props: VisitProps) {
  const action = useAction("The visit wasn't skipped. Please try again.");
  return (
    <DialogTrigger>
      <Button variant="secondary">Skip</Button>
      <Dialog
        title={`Skip the ${formatDay(props.visit.dueOn)} visit?`}
        role="alertdialog"
      >
        {({ close }) => (
          <>
            <p>
              Nothing is booked for it, and the plan carries on from its next
              date. Let the Client know.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Keep it
              </Button>
              <Button
                isPending={action.isPending}
                onPress={async () => {
                  if (
                    await action.run(
                      () => postJson(`${visitPath(props)}/skip`),
                      "Visit skipped",
                    )
                  )
                    close();
                }}
              >
                Skip visit
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}
