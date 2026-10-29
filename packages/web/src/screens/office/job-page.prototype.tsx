// PROTOTYPE: throwaway. Layouts for the Office's Job page, picked by
// ?variant= (A is the current page). Each answers "what do I do next with
// this Job?" differently, without a Card per concern; all reuse the real
// blocks, so every action works.
import { useState, type ReactNode } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import {
  Ban,
  CalendarClock,
  CalendarCheck,
  CircleCheck,
  CreditCard,
  DoorClosed,
  Send,
  UserCheck,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { JobPayment, OfficeJob } from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Heading,
  Link,
  List,
  ListItem,
  Notice,
  Section,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Table,
  TableBody,
  Cell,
  Column,
  TableHeader,
  Row,
  Timeline,
  TimelineItem,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import {
  addressOf,
  adjustmentLabel,
  clientName,
  formatDate,
  formatDateTime,
  formatHours,
  formatMoney,
} from "../format.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { ChooseNewTime, costForOffice } from "../RescheduleParts.tsx";
import { CancelJobDialog, FeePayment } from "./JobCancellation.tsx";
import {
  ConditionField,
  Correct,
  RemoveAdjustment,
  Review,
  UndoCompletion,
  describeAdjustment,
  statusBadge,
} from "./JobCompletion.tsx";
import { MoveJob } from "./JobMove.tsx";
import { TurnDown } from "./JobReschedule.tsx";
import {
  AssignmentBadge,
  Offer,
  OpenTo,
  Remove,
  sinceOf,
  stateBadge,
} from "./JobScreen.tsx";
import { homeCrumbs } from "./PropertyScreen.tsx";
import { PickFromSchedule } from "./SchedulePicker.tsx";
import { OfferServicePlan } from "./StartDraft.tsx";

const variants = [
  { key: "A", name: "Current" },
  { key: "B", name: "Timeline" },
  { key: "C", name: "Tabs" },
  { key: "D", name: "Two columns" },
];

export function JobPrototype() {
  const job = useLoaderData({ from: "/office/jobs/$jobId" });
  const { variant } = useSearch({ from: "/office/jobs/$jobId" });
  const navigate = useNavigate();
  const pick = (key: string) =>
    void navigate({
      to: ".",
      search: { variant: key },
      replace: true,
    });
  return (
    <>
      {variant === "B" && <TimelinePage job={job} />}
      {variant === "C" && <TabsPage job={job} />}
      {variant === "D" && <TwoColumnPage job={job} />}
      <PrototypeSwitcher
        variants={variants}
        current={variant ?? "A"}
        onChange={pick}
      />
    </>
  );
}

// ---- shared ----

const booked = (job: OfficeJob) => job.status === "booked";

// the header, with what can be done to the whole Job as text actions:
// none of them is the page's main action
function JobHeader({ job }: { job: OfficeJob }) {
  const onPlan = job.servicePlanId !== null;
  const terms = job.rescheduleTerms;
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
          {terms && (
            <>
              <MoveJob job={job} variant="text" />
              <ChooseNewTime
                job={job}
                terms={terms}
                base={`/api/jobs/${job.id}`}
                label="Ask for a new time"
                describeCost={(cost, feeCents) =>
                  costForOffice(cost, feeCents, onPlan)
                }
                done="Reschedule Request made"
                Picker={PickFromSchedule}
                variant="text"
              />
            </>
          )}
          {job.cancelTerms && (
            <CancelJobDialog job={job} variant="danger-text" />
          )}
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

// what there is to do with the Job, one Notice each, at most one text
// action apiece
const noticesFor = (job: OfficeJob): ReactNode[] => {
  const notices: ReactNode[] = [];
  const request = job.rescheduleRequest;
  const onPlan = job.servicePlanId !== null;

  if (request?.status === "pending") {
    notices.push(
      <Notice key="reschedule" action={<AnswerRequest job={job} />}>
        <p>
          <strong>
            {request.byClient ? "The Client asked" : "The Office asked"} to move
            it to {formatDateTime(request.startsAt)}.
          </strong>{" "}
          {costForOffice(request.cost, request.feeCents, onPlan)} The new time
          is held until you answer.
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
  const completion = job.completion;
  if (completion) {
    const toReview = completion.adjustments.filter(
      (a) => a.status === "reported",
    ).length;
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
  }
  const payment =
    completion?.payment ?? job.cancellation?.payment ?? job.noAccess?.payment;
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

function WhatsNext({ job }: { job: OfficeJob }) {
  const notices = noticesFor(job);
  if (notices.length === 0) return null;
  return <div className="flex flex-col gap-3">{notices}</div>;
}

// a pending Reschedule Request, answered in a dialog: the Notice's one action
function AnswerRequest({ job }: { job: OfficeJob }) {
  const request = job.rescheduleRequest!;
  const path = `/api/jobs/${job.id}/reschedule-request`;
  const action = useAction("That didn't work. Please try again.");
  return (
    <DialogTrigger>
      <Button variant="text" size="sm">
        <CalendarClock aria-hidden size={16} />
        Answer
      </Button>
      <Dialog title="Move this Job?">
        {({ close }) => (
          <>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold">From</dt>
              <dd>{formatDateTime(request.fromStartsAt)}</dd>
              <dt className="font-semibold">To</dt>
              <dd>{formatDateTime(request.startsAt)}</dd>
              <dt className="font-semibold">Cost</dt>
              <dd>
                {costForOffice(
                  request.cost,
                  request.feeCents,
                  job.servicePlanId !== null,
                )}
              </dd>
            </dl>
            <p className="text-sm text-fg-muted">
              Confirming moves the Job and Offers every place on it afresh. The
              Client and the crew are emailed.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <TurnDown path={`${path}/turn-down`} />
              <Button
                isPending={action.isPending}
                onPress={() =>
                  void action
                    .run(() => postJson(`${path}/confirm`), "Job moved")
                    .then((ok) => ok && close())
                }
              >
                Confirm move
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

function OfferPlace({ job }: { job: OfficeJob }) {
  return (
    <DialogTrigger>
      <Button variant="text" size="sm">
        <UserPlus aria-hidden size={16} />
        Offer a place
      </Button>
      <Dialog title="Offer a place">
        {() => <Offer key={job.assignments.length} job={job} />}
      </Dialog>
    </DialogTrigger>
  );
}

function RetryCharge({ job }: { job: OfficeJob }) {
  const action = useAction("It wasn't retried. Please try again.");
  return (
    <Button
      variant="text"
      size="sm"
      isPending={action.isPending}
      onPress={() =>
        void action.run(
          () => postJson(`/api/jobs/${job.id}/balance/retry`),
          "Charged",
        )
      }
    >
      <CreditCard aria-hidden size={16} />
      Try the charge again
    </Button>
  );
}

// the Job as it stands, in one card ruled into parts
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

function CrewList({ job }: { job: OfficeJob }) {
  if (job.assignments.length === 0) {
    return <p className="text-sm text-fg-muted">Nobody is on it yet.</p>;
  }
  return (
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
  );
}

function AdjustmentList({ job }: { job: OfficeJob }) {
  const adjustments = job.completion!.adjustments;
  if (adjustments.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        Nothing different from the Quote was reported.
      </p>
    );
  }
  return (
    <List aria-label="Adjustments">
      {adjustments.map((a) => (
        <ListItem
          key={a.id}
          id={a.id}
          title={`${adjustmentLabel(a)}: ${formatMoney(a.totalCents)}`}
          description={describeAdjustment(a)}
          end={
            <>
              {statusBadge[a.status]}
              {a.status === "reported" && <Review job={job} adjustment={a} />}
              {(a.status === "applied" || a.status === "approved") && (
                <Correct job={job} adjustment={a} />
              )}
              <RemoveAdjustment job={job} adjustment={a} />
            </>
          }
        />
      ))}
    </List>
  );
}

const chargeLabel = { deposit: "Deposit", balance: "Balance", fee: "Fee" };

// the money, without the retry: that's a Notice above
function Money({ payment }: { payment: JobPayment }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
      <dt className="font-semibold">Quoted</dt>
      <dd>{formatMoney(payment.quotedCents)}</dd>
      {payment.adjustmentsCents !== 0 && (
        <>
          <dt className="font-semibold">Adjustments</dt>
          <dd>{formatMoney(payment.adjustmentsCents)}</dd>
        </>
      )}
      <dt className="font-semibold">Total</dt>
      <dd>{formatMoney(payment.totalCents)}, tax included</dd>
      <dt className="font-semibold">Paid</dt>
      <dd>
        {formatMoney(payment.paidCents)}
        {payment.paymentMethod && ` by ${payment.paymentMethod}`}
      </dd>
      {payment.owedCents !== 0 && (
        <>
          <dt className="font-semibold">
            {payment.owedCents > 0 ? "Still owed" : "To refund"}
          </dt>
          <dd>{formatMoney(Math.abs(payment.owedCents))}</dd>
        </>
      )}
    </dl>
  );
}

// a part of the one card, ruled off from the one above
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

// the Job in one card: facts, crew, and once it's happened (or didn't),
// how it went and its money
function JobCard({ job }: { job: OfficeJob }) {
  const completion = job.completion;
  const lost = job.cancellation ?? job.noAccess;
  const confirmed = job.assignments.filter(
    (a) => a.status === "confirmed",
  ).length;
  return (
    <Card>
      <JobFacts job={job} />
      <Part
        title={`Crew · ${confirmed} of ${job.crewSize} Confirmed`}
        actions={
          booked(job) &&
          job.openPlaces > 0 &&
          job.cleaners.length > 0 && <OfferPlace job={job} />
        }
      >
        <CrewList job={job} />
      </Part>
      {completion && (
        <>
          <Part title="How it went" actions={<UndoCompletion job={job} />}>
            <ConditionField job={job} completion={completion} />
          </Part>
          <Part title="Adjustments">
            <AdjustmentList job={job} />
          </Part>
          <Part title="Money">
            <Money payment={completion.payment} />
          </Part>
        </>
      )}
      {lost && (
        <Part title="Money">
          <Money payment={lost.payment} />
        </Part>
      )}
    </Card>
  );
}

// ---- what happened, newest first ----

type Moment = {
  key: string;
  at: string;
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
};

const momentsOf = (job: OfficeJob): Moment[] => {
  const moments: Moment[] = [];
  for (const a of job.assignments) {
    moments.push({
      key: `offered-${a.id}`,
      at: a.offeredAt,
      icon: Send,
      title: `Offered to ${a.staff.name}`,
    });
    if (a.answeredAt) {
      moments.push({
        key: `answered-${a.id}`,
        at: a.answeredAt,
        icon: a.status === "confirmed" ? UserCheck : UserMinus,
        title: `${a.staff.name} ${a.status === "confirmed" ? "Confirmed" : "Released their place"}`,
      });
    }
  }
  const request = job.rescheduleRequest;
  if (request) {
    moments.push({
      key: "asked",
      at: request.requestedAt,
      icon: CalendarClock,
      title: `${request.byClient ? "The Client" : "The Office"} asked to move it`,
      description: `${formatDateTime(request.fromStartsAt)} to ${formatDateTime(request.startsAt)}`,
    });
    if (request.answeredAt) {
      moments.push({
        key: "answer",
        at: request.answeredAt,
        icon: CalendarCheck,
        title:
          request.status === "confirmed"
            ? "Moved"
            : request.status === "turned_down"
              ? "Move turned down"
              : "Move withdrawn by the Client",
        description: request.reason ?? undefined,
      });
    }
  }
  const payment =
    job.completion?.payment ??
    job.cancellation?.payment ??
    job.noAccess?.payment;
  payment?.charges.forEach((c, i) =>
    moments.push({
      key: `charge-${i}`,
      at: c.chargedAt,
      icon: CreditCard,
      title: `${chargeLabel[c.kind]} of ${formatMoney(c.amountCents)} charged`,
      description:
        c.refundedCents > 0
          ? `${formatMoney(c.refundedCents)} refunded`
          : undefined,
    }),
  );
  if (job.completion) {
    moments.push({
      key: "completed",
      at: job.completion.completedAt,
      icon: CircleCheck,
      title: "Completed",
      description: job.completion.completedBy
        ? `By ${job.completion.completedBy.name}`
        : undefined,
    });
  }
  if (job.cancellation) {
    const c = job.cancellation;
    moments.push({
      key: "cancelled",
      at: c.cancelledAt,
      icon: Ban,
      title: job.servicePlanId && c.by === "client" ? "Skipped" : "Cancelled",
      description: [
        c.by === "empire"
          ? "By Empire Cleaning, refunded in full"
          : c.late
            ? "By the Client, a Late Cancellation"
            : "By the Client, more than 24 hours ahead",
        c.reason,
      ]
        .filter(Boolean)
        .join(". "),
    });
  }
  if (job.noAccess) {
    const n = job.noAccess;
    moments.push({
      key: "no-access",
      at: n.recordedAt,
      icon: DoorClosed,
      title: "No Access",
      description: `"${n.reason}"${n.recordedBy ? `, ${n.recordedBy.name}` : ""}. Charged like a Late Cancellation.`,
    });
  }
  return moments.sort((a, b) => b.at.localeCompare(a.at));
};

// what it came to, once it isn't booked
function Outcome({ job }: { job: OfficeJob }) {
  if (job.completion) {
    return (
      <Notice tone="success">
        <p>
          <strong>
            Completed {formatDateTime(job.completion.completedAt)}
          </strong>
          {job.completion.completedBy &&
            ` by ${job.completion.completedBy.name}`}
          .
        </p>
      </Notice>
    );
  }
  if (job.cancellation || job.noAccess) {
    const moment = momentsOf(job).find(
      (m) => m.key === "cancelled" || m.key === "no-access",
    )!;
    return (
      <Notice>
        <p>
          <strong>
            {moment.title} {formatDateTime(moment.at)}.
          </strong>{" "}
          {moment.description}
        </p>
      </Notice>
    );
  }
  return null;
}

// ---- B: Timeline ----

function TimelinePage({ job }: { job: OfficeJob }) {
  const moments = momentsOf(job);
  return (
    <div className="flex flex-col gap-6">
      <JobHeader job={job} />
      <Outcome job={job} />
      <WhatsNext job={job} />
      <Timeline aria-label="This Job's story, newest first">
        <TimelineItem icon={CalendarCheck} title="Now" current>
          <JobCard job={job} />
        </TimelineItem>
        {moments.map((m) => (
          <TimelineItem
            key={m.key}
            icon={m.icon}
            title={m.title}
            when={formatDate(m.at)}
            description={m.description}
          />
        ))}
      </Timeline>
    </div>
  );
}

// ---- C: Tabs ----

function TabsPage({ job }: { job: OfficeJob }) {
  const [tab, setTab] = useState<string>("job");
  const payment =
    job.completion?.payment ??
    job.cancellation?.payment ??
    job.noAccess?.payment;
  return (
    <div className="flex flex-col gap-6">
      <JobHeader job={job} />
      <Outcome job={job} />
      <WhatsNext job={job} />
      <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
        <TabList aria-label="About this Job">
          <Tab id="job">Job</Tab>
          <Tab id="crew">Crew</Tab>
          {payment && <Tab id="money">Money</Tab>}
          <Tab id="history">History</Tab>
        </TabList>
        <TabPanel id="job">
          <Card>
            <JobFacts job={job} />
            {job.completion && (
              <Part title="How it went" actions={<UndoCompletion job={job} />}>
                <ConditionField job={job} completion={job.completion} />
              </Part>
            )}
          </Card>
        </TabPanel>
        <TabPanel id="crew">
          <Section
            title="Crew"
            description={`${job.assignments.filter((a) => a.status === "confirmed").length} of ${job.crewSize} Confirmed`}
            actions={
              booked(job) &&
              job.openPlaces > 0 &&
              job.cleaners.length > 0 && <OfferPlace job={job} />
            }
          >
            <CrewList job={job} />
          </Section>
        </TabPanel>
        {payment && (
          <TabPanel id="money">
            <div className="flex flex-col gap-6">
              {job.completion && (
                <Section title="Adjustments">
                  <AdjustmentList job={job} />
                </Section>
              )}
              <Section title="Money">
                <Card>
                  <Money payment={payment} />
                </Card>
              </Section>
            </div>
          </TabPanel>
        )}
        <TabPanel id="history">
          <HistoryTable job={job} />
        </TabPanel>
      </Tabs>
    </div>
  );
}

function HistoryTable({ job }: { job: OfficeJob }) {
  const moments = momentsOf(job);
  return (
    <Table aria-label="History">
      <TableHeader>
        <Column isRowHeader>What</Column>
        <Column>When</Column>
      </TableHeader>
      <TableBody
        items={moments.map((m) => ({ ...m, id: m.key }))}
        renderEmptyState={() => "Nothing has happened yet."}
      >
        {(m) => (
          <Row>
            <Cell>
              <span className="font-semibold">{m.title}</span>
              {m.description && (
                <span className="block text-sm text-fg-muted">
                  {m.description}
                </span>
              )}
            </Cell>
            <Cell>{formatDateTime(m.at)}</Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  );
}

// ---- D: Two columns ----

// the Job and its crew on the left; its money and story on the right
function TwoColumnPage({ job }: { job: OfficeJob }) {
  const lost = job.cancellation ?? job.noAccess;
  return (
    <div className="flex flex-col gap-6">
      <JobHeader job={job} />
      <Outcome job={job} />
      <WhatsNext job={job} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
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
          <Section
            title="Crew"
            description={`${job.assignments.filter((a) => a.status === "confirmed").length} of ${job.crewSize} Confirmed`}
            actions={
              booked(job) &&
              job.openPlaces > 0 &&
              job.cleaners.length > 0 && <OfferPlace job={job} />
            }
          >
            <CrewList job={job} />
          </Section>
          {job.completion && (
            <Section title="Adjustments">
              <AdjustmentList job={job} />
            </Section>
          )}
        </div>
        <div className="flex flex-col gap-6">
          {job.completion && (
            <Section title="Money">
              <Card>
                <Money payment={job.completion.payment} />
              </Card>
            </Section>
          )}
          {lost && (
            <Section title="Money">
              <Card>
                <FeePayment
                  job={job}
                  feeCents={lost.feeCents}
                  payment={lost.payment}
                />
              </Card>
            </Section>
          )}
          <Section title="History">
            <Card>
              <ol className="flex flex-col gap-3">
                {momentsOf(job).map((m) => (
                  <li key={m.key} className="flex flex-col">
                    <span className="text-sm font-semibold">{m.title}</span>
                    <span className="text-sm text-fg-muted">
                      {formatDate(m.at)}
                      {m.description && ` · ${m.description}`}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </Section>
        </div>
      </div>
    </div>
  );
}
