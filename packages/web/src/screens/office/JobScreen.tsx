import { useState } from "react";
import { useLoaderData } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarSync,
  CalendarX,
  CirclePlus,
  Clock,
  ContactRound,
  MapPin,
  UserPlus,
  Users,
  X,
  CircleCheck,
  Undo2,
} from "lucide-react";
import {
  isOnCrew,
  type AssignmentView,
  type OfficeJob,
  formats,
} from "@empire-cleaning/models";
import { MORE_HOURS, officeFix } from "@empire-cleaning/models";
import {
  Actions,
  Avatar,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Form,
  Link,
  List,
  ListItem,
  Notice,
  Section,
  Select,
  SelectItem,
  RecordPage,
  DetailsCard,
  DateTile,
  Facts,
  Fact,
  type Alert,
} from "@empire-cleaning/ui";
import { deleteJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { addressOf, clientName, formatHours, screenWords } from "../format.ts";
import { costForOffice } from "../RescheduleParts.tsx";
import { CancelJob, howItEnded } from "./JobCancellation.tsx";
import {
  ConditionField,
  JobMoney,
  RetryCharge,
  UndoCompletion,
} from "./JobCompletion.tsx";
import { JobHistory } from "./JobHistory.tsx";
import { AnswerRequest, AskForNewTime } from "./JobReschedule.tsx";
import { MoveJob } from "./JobMove.tsx";
import { OfferServicePlan } from "./StartDraft.tsx";
import { AssignmentStateBadge, JobBadge } from "../JobBadges.tsx";

const { assignmentStateLabel, cleaners } = screenWords.en;

const { formatDate, formatDateTime, formatMoney } = formats.en;

const sinceOf = (a: AssignmentView) =>
  a.status === "offered"
    ? `Offered ${formatDate(a.offeredAt)}`
    : `${assignmentStateLabel[a.status]} ${formatDate(a.answeredAt!)}`;

const booked = (job: OfficeJob) => job.status === "booked";

/**
 * A Job for the Office, a Record (docs/ux.md): what there is to do in
 * alerts on top; when, who for and where; how it went, who's on it and its
 * money; its story beside them from xl. Office Staff Offer it to Cleaners
 * and take people off, move or cancel it, and once it's Completed, review
 * and correct the completion.
 */
export function JobScreen() {
  const job = useLoaderData({ from: "/office/jobs/$jobId" });
  const title = `${job.serviceName} at ${placeOf(job.property)}`;
  const terms = job.rescheduleTerms;

  return (
    <RecordPage
      trail={[
        { label: "Jobs", href: linkTo({ to: "/office/jobs" }) },
        { label: title },
      ]}
      title={title}
      status={<JobBadge job={job} />}
      actions={[
        terms && {
          label: "Move job",
          icon: CalendarSync,
          dialog: (state) => <MoveJob job={job} {...state} />,
        },
        terms && {
          label: "Ask for a new time",
          icon: CalendarClock,
          dialog: (state) => <AskForNewTime job={job} {...state} />,
        },
        job.cancelTerms && {
          label: "Cancel job",
          icon: CalendarX,
          danger: true,
          dialog: (state) => <CancelJob job={job} {...state} />,
        },
        job.completion && {
          label: "Mark not done",
          icon: Undo2,
          danger: true,
          dialog: (state) => <UndoCompletion job={job} {...state} />,
        },
      ]}
      alerts={alertsFor(job)}
      details={<JobDetails job={job} />}
      history={<JobHistory job={job} />}
    >
      {job.completion && <HowItWent job={job} completion={job.completion} />}
      <Crew job={job} />
      <JobMoney job={job} />
    </RecordPage>
  );
}

// What there is to do with the Job, above it: one alert per thing, each
// with at most one text action, warning when it's the Office's to do; or,
// once it isn't booked, how it ended. Done is in How it went (WEB-5)
const alertsFor = (job: OfficeJob): Alert[] => {
  const alerts: Alert[] = [];
  const request = job.rescheduleRequest;
  const completion = job.completion;
  const payment =
    completion?.payment ?? job.cancellation?.payment ?? job.noAccess?.payment;

  const ended = howItEnded(job);
  if (ended) {
    alerts.push({
      key: "ended",
      children: (
        <p>
          <strong>{ended.title}.</strong> {ended.description}
        </p>
      ),
    });
  }
  if (request?.status === "pending") {
    alerts.push({
      key: "reschedule",
      tone: "warning",
      action: <AnswerRequest job={job} />,
      children: (
        <p>
          <strong>
            {request.byClient ? "The client asked" : "The office asked"} to move
            it to {formatDateTime(request.startsAt)}.
          </strong>{" "}
          {costForOffice(request.cost, request.feeCents, job)} The new time is
          held until you answer.
        </p>
      ),
    });
  }
  if (booked(job) && job.cleanersNeeded > 0) {
    alerts.push({
      key: "cleaners-needed",
      tone:
        job.openTo.opened && job.openTo.cleaners === 0 ? "danger" : "warning",
      action: job.cleaners.length > 0 && <OfferToCleaner job={job} />,
      children: (
        <>
          <p>
            <strong>Needs {cleaners(job.cleanersNeeded, "more")}.</strong>
          </p>
          <OpenTo job={job} />
        </>
      ),
    });
  }
  const toReview =
    completion?.adjustments.filter((a) => a.status === "reported").length ?? 0;
  if (toReview > 0) {
    alerts.push({
      key: "review",
      tone: "warning",
      children: (
        <p>
          <strong>
            The cleaner reported {toReview}{" "}
            {toReview === 1 ? "price change" : "price changes"} to check.
          </strong>
        </p>
      ),
    });
  }
  if (payment?.unpaid) {
    alerts.push({
      key: "unpaid",
      tone: "danger",
      action: <RetryCharge job={job} />,
      children: (
        <p>
          <strong>
            Unpaid since {formatDate(payment.unpaid.since)}:{" "}
            {formatMoney(payment.owedCents)} didn't go through
            {payment.unpaid.why && ` (${payment.unpaid.why})`}.
          </strong>{" "}
          {officeFix[payment.unpaid.kind]}
        </p>
      ),
    });
  }
  if (job.canOfferServicePlan) {
    alerts.push({
      key: "plan",
      action: <OfferServicePlan propertyId={job.property.id} />,
      children: <p>The first clean is paid: offer a cleaning plan.</p>,
    });
  }
  return alerts;
};

// where a Job is, for its title: the street and unit
const placeOf = (p: OfficeJob["property"]) =>
  [p.street, p.unit].filter(Boolean).join(", ");

// when, large; who it's for, where, what's in it; and while it's booked,
// until when it's free to move or cancel (WEB-2)
function JobDetails({ job }: { job: OfficeJob }) {
  return (
    <DetailsCard
      label="Job details"
      tile={<DateTile date={job.startsAt} />}
      kicker={job.serviceName}
      title={formatDateTime(job.startsAt)}
      line={`${formatHours(job.hoursOnSite)} on site`}
    >
      <Facts>
        <Fact
          icon={ContactRound}
          label="Client"
          value={
            <Link
              href={linkTo({
                to: "/office/clients/$clientId",
                params: { clientId: job.client.id },
              })}
            >
              {clientName(job.client)}
            </Link>
          }
        />
        <Fact
          icon={MapPin}
          label="Home"
          value={
            <Link
              href={linkTo({
                to: "/office/properties/$propertyId",
                params: { propertyId: job.property.id },
              })}
            >
              {addressOf(job.property)}
            </Link>
          }
        />
        <Fact
          icon={CirclePlus}
          label="Extras"
          value={job.addOns.length > 0 ? job.addOns.join(", ") : "None"}
        />
        <Fact
          icon={Clock}
          label="Cleaning hours"
          value={formatHours(job.labourHours)}
        />
        <Fact icon={Users} label="Cleaners" value={job.crewSize} />
        {job.rescheduleTerms && (
          <Fact
            icon={CalendarSync}
            label="Moving"
            value={formatDateTime(job.rescheduleTerms.freeUntil)}
            line="Free to move until then"
          />
        )}
        {job.cancelTerms && (
          <Fact
            icon={CalendarX}
            label="Cancelling"
            value={formatDateTime(job.cancelTerms.client.freeUntil)}
            line="Free for the client to cancel until then"
          />
        )}
      </Facts>
    </DetailsCard>
  );
}

// once it's done: when and by whom, and the condition the cleaner found,
// which the Office can correct
function HowItWent({
  job,
  completion,
}: {
  job: OfficeJob;
  completion: NonNullable<OfficeJob["completion"]>;
}) {
  return (
    <Section title="How it went">
      <Card>
        <Facts>
          <Fact
            icon={CircleCheck}
            label="Done"
            value={formatDateTime(completion.completedAt)}
            line={
              completion.completedBy
                ? `Done, by ${completion.completedBy.name}`
                : "Done"
            }
          />
        </Facts>
        <ConditionField job={job} completion={completion} />
      </Card>
    </Section>
  );
}

// who's on the Job, each as the Staff list draws its people: their
// picture, name and since when, a badge when it's not the usual
// (Confirmed), and while it's booked an X to take them off. Someone who
// dropped out or was taken off isn't on it: History says so (WEB-3)
function Crew({ job }: { job: OfficeJob }) {
  const crew = job.assignments.filter((a) => isOnCrew(a.status));
  const confirmed = crew.filter((a) => a.status === "confirmed").length;
  return (
    <Section
      title="Crew"
      description={`${confirmed} of ${cleaners(job.crewSize)} confirmed`}
      actions={
        booked(job) &&
        job.cleanersNeeded > 0 &&
        job.cleaners.length > 0 && <OfferToCleaner job={job} />
      }
    >
      {crew.length === 0 ? (
        <p className="text-sm text-fg-muted">Nobody is on it yet.</p>
      ) : (
        <List aria-label="Crew">
          {crew.map((a) => (
            <ListItem
              key={a.id}
              id={a.id}
              title={a.staff.name}
              start={<Avatar src={a.staff.imageUrl} />}
              description={sinceOf(a)}
              end={
                a.status !== "confirmed" && (
                  <AssignmentStateBadge state={a.status} />
                )
              }
              action={booked(job) && <Remove job={job} assignment={a} />}
            />
          ))}
        </List>
      )}
    </Section>
  );
}

// who a Job's Cleaners Needed are open to: from 7 days before it, every free
// Cleaner, first to Confirm taking each (ADR-0019)
function OpenTo({ job }: { job: OfficeJob }) {
  const { opensAt, opened, cleaners: free, passedBy } = job.openTo;
  const firstTo =
    job.cleanersNeeded === 1
      ? "the first to confirm gets it"
      : `the first ${job.cleanersNeeded} to confirm get it`;
  return (
    <>
      <p>
        {!opened
          ? `Free cleaners can take it from ${formatDateTime(opensAt)}.`
          : free === 0
            ? `No cleaner is free then. Offer it to someone, or ${MORE_HOURS}.`
            : `${cleaners(free, "free")} can take it: ${firstTo}.`}
      </p>
      {passedBy.length > 0 && (
        <p>Said no: {passedBy.map((p) => p.name).join(", ")}.</p>
      )}
    </>
  );
}

// Offers a Cleaner Needed to a Cleaner of the Office's choosing, in a dialog
function OfferToCleaner({ job }: { job: OfficeJob }) {
  return (
    <DialogTrigger>
      <Button variant="text" size="sm">
        <UserPlus aria-hidden size={16} />
        Offer to a cleaner
      </Button>
      <Dialog title="Offer to a cleaner">
        {({ close }) => <Offer job={job} close={close} />}
      </Dialog>
    </DialogTrigger>
  );
}

function Offer({ job, close }: { job: OfficeJob; close: () => void }) {
  const [staffId, setStaffId] = useState<string | null>(null);
  const action = useAction("It wasn't offered. Please try again.");

  const offer = async () => {
    if (!staffId) {
      action.fail("Pick a cleaner");
      return;
    }
    const name = job.cleaners.find((c) => c.id === staffId)?.name;
    const ok = await action.run(
      () => postJson(`/api/jobs/${job.id}/assignments`, { staffId }),
      `Offered to ${name}`,
    );
    if (ok) close();
  };

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        void offer();
      }}
    >
      <Select
        label="Offer to"
        description={`It needs ${cleaners(job.cleanersNeeded, "more")}. The hours are how long each can work that day.`}
        placeholder="Pick a cleaner"
        selectedKey={staffId}
        onSelectionChange={(key) =>
          setStaffId(key === null ? null : String(key))
        }
      >
        {job.cleaners.map((c) => (
          <SelectItem key={c.id} id={c.id} textValue={c.name}>
            {`${c.name} (${formatHours(c.hours)})`}
          </SelectItem>
        ))}
      </Select>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="quiet" onPress={close}>
          Cancel
        </Button>
        <Button type="submit" isPending={action.isPending}>
          Offer
        </Button>
      </Actions>
    </Form>
  );
}

function Remove({
  job,
  assignment,
}: {
  job: OfficeJob;
  assignment: AssignmentView;
}) {
  const action = useAction("They weren't taken off. Please try again.");
  const name = assignment.staff.name;

  const remove = async (close: () => void) => {
    const ok = await action.run(
      () => deleteJson(`/api/jobs/${job.id}/assignments/${assignment.id}`),
      `${name} taken off the job`,
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="quiet" size="icon" aria-label={`Remove ${name}`}>
        <X aria-hidden size={20} className="text-fg-muted" />
      </Button>
      <Dialog title={`Take ${name} off this job?`} role="alertdialog">
        {({ close }) => (
          <>
            <p>
              The job will need another cleaner. We'll email {name} to say they
              don't need to go.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                onPress={() => void remove(close)}
              >
                Remove
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}
