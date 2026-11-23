import { useState } from "react";
import { useLoaderData } from "@tanstack/react-router";
import {
  CalendarCheck,
  CalendarClock,
  CalendarSync,
  CalendarX,
  CirclePlus,
  ClipboardCheck,
  ClipboardList,
  Clock,
  MessageSquareText,
  Repeat,
  Sparkles,
  Undo2,
  UserPlus,
  X,
} from "lucide-react";
import {
  firstNameOf,
  isOnCrew,
  type AssignmentView,
  type OfficeJob,
  formats,
} from "@empire-cleaning/models";
import { MORE_HOURS, officeFix } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  CrewSection,
  Dialog,
  DialogTrigger,
  ExtrasSection,
  Fact,
  Facts,
  Form,
  Link,
  Notice,
  RecordPage,
  Section,
  Select,
  SelectItem,
  StatusBadge,
  type Alert,
  type DialogState,
  type PageAction,
  type StatusTone,
} from "@empire-cleaning/ui";
import { deleteJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { AccessFact, ConditionFact } from "../Fact.tsx";
import {
  addressOf,
  clientName,
  crewLabel,
  crewTone,
  formatHours,
  howLong,
  jobStatusTone,
  screenWords,
  wasSkipped,
} from "../format.ts";
import { JobFold, JobLead } from "../JobLead.tsx";
import { costForOffice } from "../RescheduleParts.tsx";
import { CancelJob } from "./JobCancellation.tsx";
import {
  AdjustmentDialog,
  Adjustments,
  CorrectCondition,
  JobMoney,
  TO_REVIEW,
  UndoCompletion,
  toReviewOf,
  useRetryCharge,
} from "./JobCompletion.tsx";
import { JobHistory } from "./JobHistory.tsx";
import { AnswerRequest, AskForNewTime } from "./JobReschedule.tsx";
import { MoveJob } from "./JobMove.tsx";
import { QUOTE_A_PLAN, useStartDraft } from "./StartDraft.tsx";

const w = screenWords.en;
const { cleaners, cancelledLabel, jobStatusLabel } = w;

const { formatDateTime } = formats.en;

const booked = (job: OfficeJob) => job.status === "booked";

// a Job that won't happen: cancelled, or the crew couldn't get in
const wontHappen = (job: OfficeJob) =>
  job.status === "cancelled" || job.status === "no_access";

/**
 * A Job for the Office, a Record (docs/ux.md), as settled on #493: titled
 * its Service, under the crumb of its day; one badge, from Jen's side; its
 * next step the split button's primary, the rest behind its arrow, and an
 * alert only for what the badge can't say. Its header card says when,
 * where and who for; then, while it's booked, its extras, crew and money.
 * Once it's over, what History doesn't say leads (how it went, its money),
 * and the rest folds under "The job". Its story is last.
 */
export function JobScreen() {
  const job = useLoaderData({ from: "/office/jobs/$jobId" });
  const { next, more } = useActionsOf(job);
  const over = !booked(job);
  const parts = (
    <>
      <ExtrasSection title={w.extras} extras={job.addOns} />
      <Crew job={job} />
    </>
  );

  return (
    <RecordPage
      trail={[
        { label: "Jobs", href: linkTo({ to: "/office/jobs" }) },
        { label: formatDateTime(job.startsAt) },
      ]}
      title={job.serviceName}
      status={<OfficeJobBadge job={job} />}
      next={next}
      actions={more}
      alerts={alertsFor(job, next)}
      details={
        <JobLead
          job={job}
          where={<WhereAndWho job={job} />}
          muted={wontHappen(job)}
        >
          {!over && <JobFacts job={job} />}
        </JobLead>
      }
      history={<JobHistory job={job} />}
    >
      {over ? (
        <>
          <HowItWent job={job} />
          <JobMoney job={job} />
          <JobFold label="The job">
            <Card hiddenTitle="Job facts">
              <JobFacts job={job} />
            </Card>
            {parts}
          </JobFold>
        </>
      ) : (
        <>
          {parts}
          <JobMoney job={job} />
        </>
      )}
    </RecordPage>
  );
}

// One badge, from Jen's side: what waits on her first (Unpaid, a price
// change To review, a Move asked, Needs cleaners), then where it stands;
// none for a booked Job, staffed, before its day, the usual case
const badgeOf = (
  job: OfficeJob,
): { label: string; tone: StatusTone } | null => {
  if (job.payment?.unpaid) return { label: w.unpaid, tone: "danger" };
  switch (job.status) {
    // booked: below
    case "booked":
      break;
    case "no_access":
      return { label: jobStatusLabel.no_access, tone: jobStatusTone.no_access };
    case "cancelled":
      return { label: cancelledLabel(wasSkipped(job)), tone: "neutral" };
    case "completed":
      return toReviewOf(job).length > 0
        ? { label: TO_REVIEW, tone: "warning" }
        : { label: jobStatusLabel.completed, tone: jobStatusTone.completed };
  }
  if (job.rescheduleRequest?.status === "pending")
    return { label: w.moveAsked, tone: "warning" };
  // once it's started, a crew short can't be filled: it's under way
  if (job.started) return { label: "In progress", tone: "success" };
  if (job.assignment === "unassigned")
    return { label: crewLabel.unassigned, tone: crewTone.unassigned };
  if (job.today) return { label: w.today, tone: "info" };
  return null;
};

function OfficeJobBadge({ job }: { job: OfficeJob }) {
  const badge = badgeOf(job);
  return badge && <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>;
}

// The page's next step, the first of these that applies: take the payment
// that failed, review a price change, answer a move asked, offer it to a
// cleaner, offer the home a cleaning plan; else, while it can move, Move
// job. The rest behind the split button's arrow, red last: what's done now
// and then (Ask for a new time, Correct the condition) is never the next
// step, so a done Job with nothing waiting has none
function useActionsOf(job: OfficeJob): {
  next?: PageAction;
  more: PageAction[];
} {
  const retry = useRetryCharge(job);
  const { start, starting } = useStartDraft();
  const request = job.rescheduleRequest;
  const [reported] = toReviewOf(job);
  const terms = job.rescheduleTerms;

  // the steps a Job waits on, the first its next
  const [next, ...steps] = [
    job.payment?.unpaid && retry,
    reported && {
      label: "Review",
      icon: ClipboardCheck,
      dialog: (state: DialogState) => (
        <AdjustmentDialog job={job} adjustment={reported} {...state} />
      ),
    },
    request?.status === "pending" && {
      label: "Answer",
      icon: CalendarCheck,
      dialog: (state: DialogState) => <AnswerRequest job={job} {...state} />,
    },
    // till it starts: then the server offers it to nobody
    booked(job) &&
      !job.started &&
      job.cleanersNeeded > 0 &&
      job.cleaners.length > 0 && {
        label: "Offer to a cleaner",
        icon: UserPlus,
        dialog: (state: DialogState) => <OfferToCleaner job={job} {...state} />,
      },
    job.canOfferServicePlan && {
      label: QUOTE_A_PLAN,
      icon: Repeat,
      isPending: starting === "service_plan",
      onAction: () =>
        void start({ propertyId: job.property.id, kind: "service_plan" }),
    },
    terms && {
      label: "Move job",
      icon: CalendarSync,
      dialog: (state: DialogState) => <MoveJob job={job} {...state} />,
    },
  ].filter((a): a is PageAction => !!a);
  // and what's done now and then, never the next step
  const rest: (PageAction | false | null | undefined)[] = [
    terms && {
      label: "Ask for a new time",
      icon: CalendarClock,
      dialog: (state: DialogState) => <AskForNewTime job={job} {...state} />,
    },
    job.completion && {
      label: "Correct the condition",
      icon: Sparkles,
      dialog: (state: DialogState) => <CorrectCondition job={job} {...state} />,
    },
    job.cancelTerms && {
      label: "Cancel job",
      icon: CalendarX,
      danger: true,
      dialog: (state: DialogState) => <CancelJob job={job} {...state} />,
    },
    job.completion && {
      label: "Mark not done",
      icon: Undo2,
      danger: true,
      dialog: (state: DialogState) => <UndoCompletion job={job} {...state} />,
    },
  ];
  return {
    next,
    more: [...steps, ...rest.filter((a): a is PageAction => !!a)],
  };
}

// only what the badge can't say: to when a move is asked and what it
// costs; why a payment failed and what puts it right; that no cleaner is
// free to take it; why a plan is the next step (the client asked for
// regular visits, and this was their first clean), while it is.
// The step each calls for is the page's primary
const alertsFor = (job: OfficeJob, next?: PageAction): Alert[] => {
  const alerts: Alert[] = [];
  const request = job.rescheduleRequest;
  const unpaid = job.payment?.unpaid;
  if (request?.status === "pending") {
    alerts.push({
      key: "reschedule",
      tone: "warning",
      children: (
        <p>
          <strong>
            {request.byClient
              ? `${firstNameOf(job.client.name)} asked`
              : "The office asked"}{" "}
            to move it to {formatDateTime(request.startsAt)}.
          </strong>{" "}
          {costForOffice(request.cost, request.feeCents, job)} The new time is
          held until you answer.
        </p>
      ),
    });
  }
  if (job.payment && unpaid) {
    alerts.push({
      key: "unpaid",
      tone: "danger",
      children: (
        <p>
          <strong>
            Its payment didn't go through{unpaid.why && ` (${unpaid.why})`}.
          </strong>{" "}
          {officeFix[unpaid.kind]}
        </p>
      ),
    });
  }
  if (
    booked(job) &&
    !job.started &&
    job.cleanersNeeded > 0 &&
    job.openTo.opened &&
    job.openTo.cleaners === 0
  ) {
    alerts.push({
      key: "no-cleaner-free",
      tone: "danger",
      children: (
        <p>
          <strong>No cleaner is free then.</strong> Offer it to someone, or{" "}
          {MORE_HOURS}.
        </p>
      ),
    });
  }
  // only while the plan is the step: under a review or a retry, it waits
  if (next?.label === QUOTE_A_PLAN) {
    alerts.push({
      key: "plan",
      tone: "info",
      children: (
        <p>
          <strong>{firstNameOf(job.client.name)} wants regular visits.</strong>{" "}
          This was their first clean, and they have no cleaning plan.
        </p>
      ),
    });
  }
  return alerts;
};

// where, and who for, under the header card's times: each a link to its
// page
function WhereAndWho({ job }: { job: OfficeJob }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <Link
        href={linkTo({
          to: "/office/properties/$propertyId",
          params: { propertyId: job.property.id },
        })}
      >
        {addressOf(job.property)}
      </Link>
      <Link
        href={linkTo({
          to: "/office/clients/$clientId",
          params: { clientId: job.client.id },
        })}
      >
        {clientName(job.client)}
      </Link>
    </span>
  );
}

// a fact each: how long; the cleaning hours, for a crew of more than one
// (for one, they're how long); how many extras, the signpost to their list;
// while it's free to move or cancel, until when (one row when the two
// agree); and how we get in, last and the card's width
function JobFacts({ job }: { job: OfficeJob }) {
  const moveUntil =
    job.rescheduleTerms?.cost === "free" ? job.rescheduleTerms.freeUntil : null;
  const cancelTerms = job.cancelTerms?.client;
  const cancelUntil =
    cancelTerms && !cancelTerms.late && cancelTerms.feeCents === 0
      ? cancelTerms.freeUntil
      : null;
  return (
    <Facts>
      <Fact
        icon={Clock}
        label={w.howLong}
        value={howLong(w, job.hoursOnSite)}
      />
      {job.crewSize > 1 && (
        <Fact
          icon={ClipboardList}
          label="Cleaning hours"
          value={howLong(w, job.labourHours)}
          line="Cleaning hours, the crew together"
        />
      )}
      {job.addOns.length > 0 && (
        <Fact icon={CirclePlus} label={w.extras} value={job.addOns.length} />
      )}
      {moveUntil && moveUntil === cancelUntil ? (
        <Fact
          icon={CalendarCheck}
          label="Free to move or cancel"
          value={formatDateTime(moveUntil)}
          line="Free for the client to move or cancel until"
        />
      ) : (
        <>
          {moveUntil && (
            <Fact
              icon={CalendarCheck}
              label="Free to move"
              value={formatDateTime(moveUntil)}
              line="Free for the client to move until"
            />
          )}
          {cancelUntil && (
            <Fact
              icon={CalendarCheck}
              label="Free to cancel"
              value={formatDateTime(cancelUntil)}
              line="Free for the client to cancel until"
            />
          )}
        </>
      )}
      {job.property.accessInstructions && (
        <AccessFact property={job.property} className="col-span-full" />
      )}
    </Facts>
  );
}

// once it's over, only what History doesn't say: done, the home's condition
// the cleaner found and the price changes they reported; couldn't get in,
// what the cleaner said. A cancelled Job has none: History says why
function HowItWent({ job }: { job: OfficeJob }) {
  const { completion, noAccess } = job;
  if (!completion && !noAccess) return null;
  return (
    <Section title="How it went">
      <Card>
        <Facts>
          {completion && (
            <ConditionFact
              property={completion}
              line="How dirty the home was"
            />
          )}
          {noAccess && (
            <Fact
              icon={MessageSquareText}
              label={`What ${noAccess.recordedBy?.name ?? "the cleaner"} said`}
              value={noAccess.reason}
              className="col-span-full"
            />
          )}
        </Facts>
      </Card>
      {completion && <Adjustments job={job} />}
    </Section>
  );
}

// the crew as faces (Crew.tsx): while it's booked, everyone on it, a ghost
// for each still needed, a ✕ to take each off till it starts, and in its
// line who its Cleaners Needed are open to (ADR-0019) and who said no. Once
// it's over, who was there (`over`); nobody, no part
function Crew({ job }: { job: OfficeJob }) {
  const over = !booked(job);
  const crew = job.assignments.filter((a) => isOnCrew(a.status));
  return (
    <CrewSection
      title="Crew"
      size={job.crewSize}
      over={over}
      line={over ? undefined : openToOf(job)}
      members={crew.map((a) => ({
        name: a.staff.name,
        confirmed: a.status === "confirmed",
        picture: a.staff.imageUrl,
        action: !over && !job.started && <Remove job={job} assignment={a} />,
      }))}
    />
  );
}

// who a booked Job's Cleaners Needed are open to: from 7 days before it,
// every free Cleaner, first to Confirm taking each (ADR-0019; none free is
// the page's alert); and who said no
const openToOf = (job: OfficeJob) => {
  const { opensAt, opened, cleaners: free, passedBy } = job.openTo;
  const firstTo =
    job.cleanersNeeded === 1
      ? "the first to confirm gets it"
      : `the first ${job.cleanersNeeded} to confirm get it`;
  const openTo =
    job.cleanersNeeded > 0 &&
    (!opened
      ? `Cleaners free that day can take it from ${formatDateTime(opensAt)}.`
      : free > 0 && `${cleaners(free, "free")} can take it: ${firstTo}.`);
  const saidNo =
    passedBy.length > 0 &&
    `Said no: ${passedBy.map((p) => p.name).join(", ")}.`;
  return [openTo, saidNo].filter(Boolean).join(" ") || undefined;
};

// Offers a Cleaner Needed to a Cleaner of the Office's choosing, in a dialog
function OfferToCleaner({ job, ...state }: { job: OfficeJob } & DialogState) {
  return (
    <Dialog title="Offer to a cleaner" {...state}>
      {({ close }) => <Offer job={job} close={close} />}
    </Dialog>
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
        <X aria-hidden size={18} className="text-fg-muted" />
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
