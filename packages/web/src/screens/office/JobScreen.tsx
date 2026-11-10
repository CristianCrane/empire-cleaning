import { useState, type ReactNode } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import {
  isOnCrew,
  type AssignmentView,
  type OfficeJob,
  formats,
} from "@empire-cleaning/models";
import { MORE_HOURS, officeFix } from "@empire-cleaning/models";
import {
  ActionBar,
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  Link,
  List,
  ListItem,
  Notice,
  Section,
  Select,
  SelectItem,
} from "@empire-cleaning/ui";
import { deleteJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { addressOf, clientName, formatHours, screenWords } from "../format.ts";
import { costForOffice } from "../RescheduleParts.tsx";
import { CancelJob, FeeMoney, howItEnded } from "./JobCancellation.tsx";
import {
  Adjustments,
  ConditionField,
  JobMoney,
  RetryCharge,
  UndoCompletion,
} from "./JobCompletion.tsx";
import { JobHistory } from "./JobHistory.tsx";
import { AnswerRequest, MoveActions } from "./JobReschedule.tsx";
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
 * A Job for the Office, all of it in one view: what there is to do in
 * Notices on top, then two columns, the Job, who's on it and its money on
 * the left, its story on the right, where it has room to grow. Office Staff
 * Offer it to Cleaners and take people off, move or cancel it, and once it's
 * Completed, review and correct the completion.
 */
export function JobScreen() {
  const job = useLoaderData({ from: "/office/jobs/$jobId" });
  const lost = job.cancellation ?? job.noAccess;

  return (
    <div className="flex flex-col gap-6">
      <JobHeader job={job} />
      <WhatsNext job={job} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <Section title="Job">
            <Card>
              <JobFacts job={job} />
              {job.completion && (
                <Part
                  title="How it went"
                  actions={<UndoCompletion job={job} />}
                >
                  <ConditionField job={job} completion={job.completion} />
                </Part>
              )}
            </Card>
          </Section>
          <Crew job={job} />
          {job.completion && <Adjustments job={job} />}
          {(job.completion || lost) && (
            <Section title="Money">
              <Card>
                {job.completion ? (
                  <JobMoney payment={job.completion.payment} />
                ) : (
                  <FeeMoney feeCents={lost!.feeCents} payment={lost!.payment} />
                )}
              </Card>
            </Section>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <JobHistory job={job} />
        </div>
      </div>
    </div>
  );
}

// the title says what and where, the time under it; beside it, what can
// be done to the whole Job as text actions: none of them is the page's
// main action
function JobHeader({ job }: { job: OfficeJob }) {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        trail={[
          { label: "Jobs", href: linkTo({ to: "/office/jobs" }) },
          { label: "Job" },
        ]}
      />
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <Heading level={1}>
              {job.serviceName} at {placeOf(job.property)}
            </Heading>
            <JobBadge job={job} />
          </div>
          <p className="text-lg text-fg-muted">
            {formatDateTime(job.startsAt)}
          </p>
        </div>
        {(job.rescheduleTerms || job.cancelTerms) && (
          <div className="ml-auto">
            <ActionBar aria-label="Job actions">
              <MoveActions job={job} />
              {job.cancelTerms && <CancelJob job={job} />}
            </ActionBar>
          </div>
        )}
      </div>
    </div>
  );
}

// What there is to do with the Job, above it: one Notice per thing, each
// with at most one text action, warning when it's the Office's to do; or,
// once it isn't booked, how it ended
function WhatsNext({ job }: { job: OfficeJob }) {
  const notices = noticesFor(job);
  if (notices.length === 0) return null;
  return <div className="flex flex-col gap-3">{notices}</div>;
}

const noticesFor = (job: OfficeJob): ReactNode[] => {
  const notices: ReactNode[] = [];
  const request = job.rescheduleRequest;
  const completion = job.completion;
  const payment =
    completion?.payment ?? job.cancellation?.payment ?? job.noAccess?.payment;

  if (completion) {
    notices.push(
      <Notice key="completed" tone="success">
        <p>
          <strong>Done {formatDateTime(completion.completedAt)}</strong>
          {completion.completedBy && ` by ${completion.completedBy.name}`}.
        </p>
      </Notice>,
    );
  }
  const ended = howItEnded(job);
  if (ended) {
    notices.push(
      <Notice key="ended">
        <p>
          <strong>{ended.title}.</strong> {ended.description}
        </p>
      </Notice>,
    );
  }
  if (request?.status === "pending") {
    notices.push(
      <Notice
        key="reschedule"
        tone="warning"
        action={<AnswerRequest job={job} />}
      >
        <p>
          <strong>
            {request.byClient ? "The client asked" : "The office asked"} to move
            it to {formatDateTime(request.startsAt)}.
          </strong>{" "}
          {costForOffice(request.cost, request.feeCents, job)} The new time is
          held until you answer.
        </p>
      </Notice>,
    );
  }
  if (booked(job) && job.cleanersNeeded > 0) {
    notices.push(
      <Notice
        key="cleaners-needed"
        tone={
          job.openTo.opened && job.openTo.cleaners === 0 ? "danger" : "warning"
        }
        action={job.cleaners.length > 0 && <OfferToCleaner job={job} />}
      >
        <p>
          <strong>Needs {cleaners(job.cleanersNeeded, "more")}.</strong>
        </p>
        <OpenTo job={job} />
      </Notice>,
    );
  }
  const toReview =
    completion?.adjustments.filter((a) => a.status === "reported").length ?? 0;
  if (toReview > 0) {
    notices.push(
      <Notice key="review" tone="warning">
        <p>
          <strong>
            The cleaner reported {toReview}{" "}
            {toReview === 1 ? "price change" : "price changes"} to check.
          </strong>{" "}
          Each is only added once the client approves it.
        </p>
      </Notice>,
    );
  }
  if (payment?.unpaid) {
    notices.push(
      <Notice key="unpaid" tone="danger" action={<RetryCharge job={job} />}>
        <p>
          <strong>
            Unpaid since {formatDate(payment.unpaid.since)}:{" "}
            {formatMoney(payment.owedCents)} didn't go through
            {payment.unpaid.why && ` (${payment.unpaid.why})`}.
          </strong>{" "}
          {officeFix[payment.unpaid.kind]}
        </p>
      </Notice>,
    );
  }
  if (job.canOfferServicePlan) {
    notices.push(
      <Notice
        key="plan"
        action={<OfferServicePlan propertyId={job.property.id} />}
      >
        <p>
          This home's first clean is done, so you can offer a cleaning plan.
        </p>
      </Notice>,
    );
  }
  return notices;
};

// where a Job is, for its title: the street and unit
const placeOf = (p: OfficeJob["property"]) =>
  [p.street, p.unit].filter(Boolean).join(", ");

// who it's for and what it is, and while it's booked, until when it's free to move or
// cancel
function JobFacts({ job }: { job: OfficeJob }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
      <dt className="font-semibold">Client</dt>
      <dd>
        <Link
          href={linkTo({
            to: "/office/clients/$clientId",
            params: { clientId: job.client.id },
          })}
        >
          {clientName(job.client)}
        </Link>
      </dd>
      <dt className="font-semibold">Home</dt>
      <dd>
        <Link
          href={linkTo({
            to: "/office/properties/$propertyId",
            params: { propertyId: job.property.id },
          })}
        >
          {addressOf(job.property)}
        </Link>
      </dd>
      <dt className="font-semibold">Extras</dt>
      <dd>{job.addOns.length > 0 ? job.addOns.join(", ") : "None"}</dd>
      <dt className="font-semibold">Cleaning hours</dt>
      <dd>{formatHours(job.labourHours)}</dd>
      <dt className="font-semibold">Cleaners</dt>
      <dd>
        {job.crewSize}, {formatHours(job.hoursOnSite)} on site
      </dd>
      {job.rescheduleTerms && (
        <>
          <dt className="font-semibold">Moving</dt>
          <dd>Free until {formatDateTime(job.rescheduleTerms.freeUntil)}</dd>
        </>
      )}
      {job.cancelTerms && (
        <>
          <dt className="font-semibold">Cancelling</dt>
          <dd>
            Free for the client until{" "}
            {formatDateTime(job.cancelTerms.client.freeUntil)}
          </dd>
        </>
      )}
    </dl>
  );
}

// a part of a card, ruled off from the one above
function Part({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Heading level={3}>{title}</Heading>
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// who's on the Job: each Assignment Offered, Confirmed or Released
function Crew({ job }: { job: OfficeJob }) {
  const confirmed = job.assignments.filter(
    (a) => a.status === "confirmed",
  ).length;
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
      {job.assignments.length === 0 ? (
        <p className="text-sm text-fg-muted">Nobody is on it yet.</p>
      ) : (
        <List aria-label="Crew">
          {job.assignments.map((a) => (
            <ListItem
              key={a.id}
              id={a.id}
              title={a.staff.name}
              description={sinceOf(a)}
              end={
                <>
                  <AssignmentStateBadge state={a.status} />
                  {booked(job) && isOnCrew(a.status) && (
                    <Remove job={job} assignment={a} />
                  )}
                </>
              }
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
      <Button variant="quiet" size="sm" aria-label={`Remove ${name}`}>
        Remove
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
