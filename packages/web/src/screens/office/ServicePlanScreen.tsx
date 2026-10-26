import { useState } from "react";
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
  StatusBadge,
  TimeField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  cleanTypeLabel,
  formatDateTime,
  formatDay,
  recurrenceLabel,
  timeOfDay,
} from "../format.ts";
import { PlanStatusBadge, PlanTerms } from "../PlanParts.tsx";
import { useJobAction } from "./JobCompletion.tsx";
import { homeCrumbs, jobStatusLabel } from "./PropertyScreen.tsx";
import { PickFromSchedule } from "./SchedulePicker.tsx";

// a Service Plan for the Office: its terms, every Job it has booked, and the
// dates it came round with no room, for Office Staff to book at another time
// they agree with the Client, or skip
export function ServicePlanScreen() {
  const plan = useLoaderData({ from: "/office/service-plans/$planId" });
  const navigate = useNavigate();

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
          {plan.client.name} · {addressOf(plan.property)}
        </p>
      </div>

      {plan.unplaced.length > 0 && (
        <Card
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
        </Card>
      )}

      <Card
        title={`${cleanTypeLabel[plan.cleanType]}, ${recurrenceLabel[plan.recurrence].toLowerCase()}`}
        description={
          <>
            Accepted from{" "}
            <Link
              href={linkTo({
                to: "/office/quotes/$quoteId",
                params: { quoteId: plan.quoteId },
              })}
            >
              its Service Plan Quote
            </Link>
            , which its Jobs are priced from.
          </>
        }
      >
        <PlanTerms plan={plan} />
      </Card>

      <Card
        title="Jobs"
        description="Each goes on the Schedule about 4 weeks ahead, Offered to the crew of the one before."
      >
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
      </Card>
    </div>
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
  const usual = timeOfDay(plan.firstStartsAt);
  const [date, setDate] = useState<CalendarDate | null>(parseDate(visit.dueOn));
  const [time, setTime] = useState<Time | null>(parseTime(usual));
  const action = useJobAction("The visit wasn't booked. Please try again.");
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
        hoursOnSite={plan.hoursOnSite}
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
  const action = useJobAction("The visit wasn't skipped. Please try again.");
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
