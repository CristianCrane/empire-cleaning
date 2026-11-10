import { useState, type ReactNode } from "react";
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
  type LucideIcon,
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
  MenuButton,
  MenuItem,
  MenuSeparator,
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
          <Section title="Job details">
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

// the title says what and where, the time under it; at the end of its row,
// what can be done to the whole Job in an Actions menu: none of them is the
// page's main action
function JobHeader({ job }: { job: OfficeJob }) {
  const [open, setOpen] = useState<JobAction | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        trail={[
          { label: "Jobs", href: linkTo({ to: "/office/jobs" }) },
          { label: "Job" },
        ]}
      />
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
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
          <MenuButton label="Actions">
            {job.rescheduleTerms && (
              <>
                <MenuItem icon={CalendarSync} onAction={() => setOpen("move")}>
                  Move job
                </MenuItem>
                <MenuItem icon={CalendarClock} onAction={() => setOpen("ask")}>
                  Ask for a new time
                </MenuItem>
              </>
            )}
            {/* a rule before Cancel only with something above it */}
            {job.rescheduleTerms && job.cancelTerms && <MenuSeparator />}
            {job.cancelTerms && (
              <MenuItem
                icon={CalendarX}
                danger
                onAction={() => setOpen("cancel")}
              >
                Cancel job
              </MenuItem>
            )}
          </MenuButton>
        )}
      </div>
      <JobDialogs job={job} open={open} setOpen={setOpen} />
    </div>
  );
}

// what can be done to the whole Job, each in a dialog; which one is open
type JobAction = "move" | "ask" | "cancel";

function JobDialogs({
  job,
  open,
  setOpen,
}: {
  job: OfficeJob;
  open: JobAction | null;
  setOpen: (open: JobAction | null) => void;
}) {
  const openAs = (action: JobAction) => ({
    isOpen: open === action,
    onOpenChange: (isOpen: boolean) => setOpen(isOpen ? action : null),
  });
  return (
    <>
      {job.rescheduleTerms && (
        <>
          <MoveJob job={job} {...openAs("move")} />
          <AskForNewTime job={job} {...openAs("ask")} />
        </>
      )}
      {job.cancelTerms && <CancelJob job={job} {...openAs("cancel")} />}
    </>
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

// who it's for and what it is, and while it's booked, until when it's free
// to move or cancel: each fact's label with its icon beside it, the value
// after it (under it on a phone)
function JobFacts({ job }: { job: OfficeJob }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
      <Fact icon={ContactRound} label="Client">
        <Link
          href={linkTo({
            to: "/office/clients/$clientId",
            params: { clientId: job.client.id },
          })}
        >
          {clientName(job.client)}
        </Link>
      </Fact>
      <Fact icon={MapPin} label="Home">
        <Link
          href={linkTo({
            to: "/office/properties/$propertyId",
            params: { propertyId: job.property.id },
          })}
        >
          {addressOf(job.property)}
        </Link>
      </Fact>
      <Fact icon={CirclePlus} label="Extras">
        {job.addOns.length > 0 ? job.addOns.join(", ") : "None"}
      </Fact>
      <Fact icon={Clock} label="Cleaning hours">
        {formatHours(job.labourHours)}
      </Fact>
      <Fact icon={Users} label="Cleaners">
        {job.crewSize}, {formatHours(job.hoursOnSite)} on site
      </Fact>
      {job.rescheduleTerms && (
        <Fact icon={CalendarSync} label="Moving">
          Free until {formatDateTime(job.rescheduleTerms.freeUntil)}
        </Fact>
      )}
      {job.cancelTerms && (
        <Fact icon={CalendarX} label="Cancelling">
          Free for the client until{" "}
          {formatDateTime(job.cancelTerms.client.freeUntil)}
        </Fact>
      )}
    </dl>
  );
}

// one of the Job's facts: its icon and label, then its value
function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden size={18} className="shrink-0 text-fg-muted" />
        {label}
      </dt>
      <dd className="max-sm:mb-2 max-sm:pl-7">{children}</dd>
    </>
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

// who's on the Job, each Assignment as the Staff list draws its people:
// their picture, name and since when, a badge when it's not the usual
// (Confirmed), and while it's booked an X to take them off
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
              start={<Avatar src={a.staff.imageUrl} />}
              description={sinceOf(a)}
              end={
                a.status !== "confirmed" && (
                  <AssignmentStateBadge state={a.status} />
                )
              }
              action={
                booked(job) &&
                isOnCrew(a.status) && <Remove job={job} assignment={a} />
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
