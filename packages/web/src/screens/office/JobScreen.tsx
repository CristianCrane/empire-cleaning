import { useState, type ReactNode } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import type {
  AssignmentState,
  AssignmentView,
  OfficeJob,
  ScheduledJob,
} from "@empire-cleaning/models";
import {
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
  StatusBadge,
} from "@empire-cleaning/ui";
import { deleteJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import {
  addressOf,
  clientName,
  formatDate,
  formatDateTime,
  formatHours,
  formatMoney,
} from "../format.ts";
import { costForOffice } from "../RescheduleParts.tsx";
import { CancelJob, FeeMoney, howItEnded } from "./JobCancellation.tsx";
import {
  ConditionField,
  JobMoney,
  RetryCharge,
  UndoCompletion,
} from "./JobCompletion.tsx";
import { AdjustmentsPrototype } from "./adjustments.prototype.tsx";
import { JobHistory } from "./JobHistory.tsx";
import { AnswerRequest, MoveActions } from "./JobReschedule.tsx";
import { homeCrumbs } from "./PropertyScreen.tsx";
import { OfferServicePlan } from "./StartDraft.tsx";

// whether every place on a Job's crew is Confirmed, or once it has happened
// or been Cancelled, how it went
export function AssignmentBadge({ job }: { job: ScheduledJob }) {
  if (job.status === "completed") {
    return <StatusBadge tone="success">Completed</StatusBadge>;
  }
  if (job.status === "no_access") {
    return <StatusBadge tone="danger">No Access</StatusBadge>;
  }
  if (job.status === "cancelled") {
    return <StatusBadge>Cancelled</StatusBadge>;
  }
  return job.assignment === "assigned" ? (
    <StatusBadge tone="info">Assigned</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Unassigned</StatusBadge>
  );
}

const stateBadge: Record<AssignmentState, ReactNode> = {
  offered: <StatusBadge tone="warning">Offered</StatusBadge>,
  confirmed: <StatusBadge tone="success">Confirmed</StatusBadge>,
  released: <StatusBadge>Released</StatusBadge>,
};

const sinceOf = (a: AssignmentView) =>
  a.status === "offered"
    ? `Offered ${formatDate(a.offeredAt)}`
    : `${a.status === "confirmed" ? "Confirmed" : "Released"} ${formatDate(a.answeredAt!)}`;

const booked = (job: OfficeJob) => job.status === "booked";

/**
 * A Job for the Office, all of it in one view: what there is to do in
 * Notices on top, then two columns, the Job and who's on it on the left,
 * its money and story on the right. Office Staff Offer its places and take
 * people off, move or cancel it, and once it's Completed, review and correct
 * the completion.
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
          {/* PROTOTYPE: ?variant= swaps the Adjustments layout */}
          {job.completion && <AdjustmentsPrototype job={job} />}
        </div>
        <div className="flex flex-col gap-6">
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
          <JobHistory job={job} />
        </div>
      </div>
    </div>
  );
}

// the title, and what can be done to the whole Job as text actions: none
// of them is the page's main action
function JobHeader({ job }: { job: OfficeJob }) {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        trail={[
          { label: "Schedule", href: linkTo({ to: "/office/schedule" }) },
          ...homeCrumbs(job.client, job.property),
          { label: "Job" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Heading level={1}>{formatDateTime(job.startsAt)}</Heading>
        <AssignmentBadge job={job} />
        <div className="ml-auto flex flex-wrap gap-2">
          <MoveActions job={job} />
          {job.cancelTerms && <CancelJob job={job} />}
        </div>
      </div>
      <p className="text-fg-muted">
        <Link
          href={linkTo({
            to: "/office/clients/$clientId",
            params: { clientId: job.client.id },
          })}
        >
          {clientName(job.client)}
        </Link>{" "}
        ·{" "}
        <Link
          href={linkTo({
            to: "/office/properties/$propertyId",
            params: { propertyId: job.property.id },
          })}
        >
          {addressOf(job.property)}
        </Link>{" "}
        · {job.serviceName}
      </p>
    </div>
  );
}

// What there is to do with the Job, above it: one Notice per thing, each
// with at most one text action; or, once it isn't booked, how it ended
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
          <strong>Completed {formatDateTime(completion.completedAt)}</strong>
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
      <Notice key="reschedule" action={<AnswerRequest job={job} />}>
        <p>
          <strong>
            {request.byClient ? "The Client asked" : "The Office asked"} to move
            it to {formatDateTime(request.startsAt)}.
          </strong>{" "}
          {costForOffice(
            request.cost,
            request.feeCents,
            job.servicePlanId !== null,
          )}{" "}
          The new time is held until you answer.
        </p>
      </Notice>,
    );
  }
  if (booked(job) && job.openPlaces > 0) {
    notices.push(
      <Notice
        key="places"
        tone={
          job.openTo.opened && job.openTo.cleaners === 0 ? "danger" : "info"
        }
        action={job.cleaners.length > 0 && <OfferPlace job={job} />}
      >
        <p>
          <strong>
            {job.crewSize - job.openPlaces} of {job.crewSize}{" "}
            {job.crewSize === 1 ? "place" : "places"} held.
          </strong>
        </p>
        <OpenTo job={job} />
      </Notice>,
    );
  }
  const toReview =
    completion?.adjustments.filter((a) => a.status === "reported").length ?? 0;
  if (toReview > 0) {
    notices.push(
      <Notice key="review">
        <p>
          <strong>
            The Cleaner reported {toReview}{" "}
            {toReview === 1 ? "increase" : "increases"} to review.
          </strong>{" "}
          Each is only charged once the Client approves it.
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
            {formatMoney(payment.owedCents)} couldn't be charged
          </strong>{" "}
          ({payment.unpaid.reason}). The Client has been emailed to update their
          Payment Method, which tries again.
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
          This home's First Clean is Completed, so it can be offered regular
          cleaning.
        </p>
      </Notice>,
    );
  }
  return notices;
};

// what the Job is, and while it's booked, until when it's free to move or
// cancel
function JobFacts({ job }: { job: OfficeJob }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
      <dt className="font-semibold">Clean</dt>
      <dd>{job.serviceName}</dd>
      <dt className="font-semibold">Add-ons</dt>
      <dd>{job.addOns.length > 0 ? job.addOns.join(", ") : "None"}</dd>
      <dt className="font-semibold">Labour Hours</dt>
      <dd>{formatHours(job.labourHours)}</dd>
      <dt className="font-semibold">Crew</dt>
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
            Free for the Client until{" "}
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

// who's on the Job: each place Offered, Confirmed or Released
function Crew({ job }: { job: OfficeJob }) {
  const confirmed = job.assignments.filter(
    (a) => a.status === "confirmed",
  ).length;
  return (
    <Section
      title="Crew"
      description={`${confirmed} of ${job.crewSize} ${job.crewSize === 1 ? "place" : "places"} Confirmed`}
      actions={
        booked(job) &&
        job.openPlaces > 0 &&
        job.cleaners.length > 0 && <OfferPlace job={job} />
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
                  {stateBadge[a.status]}
                  {booked(job) && a.status !== "released" && (
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

// who a Job's Open Places are open to: from 7 days before it, every free
// Cleaner, first to Confirm taking each (ADR-0019)
function OpenTo({ job }: { job: OfficeJob }) {
  const { opensAt, opened, cleaners, passedBy } = job.openTo;
  const places =
    job.openPlaces === 1
      ? "Its open place"
      : `Its ${job.openPlaces} open places`;
  return (
    <>
      <p>
        {!opened
          ? `${places} ${job.openPlaces === 1 ? "opens" : "open"} to free Cleaners on ${formatDateTime(opensAt)}.`
          : cleaners === 0
            ? `No Cleaner is free for ${places.toLowerCase()}. Offer it to someone, or give a Cleaner hours that day.`
            : `${places} ${job.openPlaces === 1 ? "is" : "are"} open to ${cleaners} free ${cleaners === 1 ? "Cleaner" : "Cleaners"}. The first to confirm takes each.`}
      </p>
      {passedBy.length > 0 && (
        <p>Not for them: {passedBy.map((p) => p.name).join(", ")}.</p>
      )}
    </>
  );
}

// Offers an open place to a Cleaner of the Office's choosing, in a dialog
function OfferPlace({ job }: { job: OfficeJob }) {
  return (
    <DialogTrigger>
      <Button variant="text" size="sm">
        <UserPlus aria-hidden size={16} />
        Offer a place
      </Button>
      <Dialog title="Offer a place">
        {({ close }) => <Offer job={job} close={close} />}
      </Dialog>
    </DialogTrigger>
  );
}

function Offer({ job, close }: { job: OfficeJob; close: () => void }) {
  const [staffId, setStaffId] = useState<string | null>(null);
  const action = useAction("The place wasn't offered. Please try again.");

  const offer = async () => {
    if (!staffId) {
      action.fail("Choose a Cleaner");
      return;
    }
    const name = job.cleaners.find((c) => c.id === staffId)?.name;
    const ok = await action.run(
      () => postJson(`/api/jobs/${job.id}/assignments`, { staffId }),
      `Place offered to ${name}`,
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
        description={`${job.openPlaces} ${job.openPlaces === 1 ? "place" : "places"} to offer. Hours are what each is available that day.`}
        placeholder="Choose a Cleaner"
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
        <Button variant="secondary" onPress={close}>
          Cancel
        </Button>
        <Button type="submit" isPending={action.isPending}>
          Offer place
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
      `${name} taken off the Job`,
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="quiet" size="sm" aria-label={`Remove ${name}`}>
        Remove
      </Button>
      <Dialog title={`Take ${name} off this Job?`} role="alertdialog">
        {({ close }) => (
          <>
            <p>
              Their place becomes free to offer to someone else. We'll email{" "}
              {name} to say they don't need to go.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
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
