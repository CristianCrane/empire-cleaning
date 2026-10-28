import { useState, type ReactNode } from "react";
import { useLoaderData } from "@tanstack/react-router";
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
} from "../format.ts";
import { CancelJob, CancelledCard, NoAccessCard } from "./JobCancellation.tsx";
import { JobCompletionCards } from "./JobCompletion.tsx";
import { JobReschedule } from "./JobReschedule.tsx";
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

// a Job, and who's on it: Office Staff Offer its places to Cleaners and take
// people off, move or cancel it, and once it's Completed, review and correct the
// completion
export function JobScreen() {
  const job = useLoaderData({ from: "/office/jobs/$jobId" });
  const confirmed = job.assignments.filter(
    (a) => a.status === "confirmed",
  ).length;

  return (
    <div className="flex flex-col gap-6">
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
        </div>
      </div>

      <Card title="Job">
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
        </dl>
      </Card>

      {job.completion && <JobCompletionCards job={job} />}
      {job.canOfferServicePlan && (
        <Card
          title="Service Plan"
          description="This home's First Clean is Completed, so it can be offered regular cleaning."
          actions={<OfferServicePlan propertyId={job.property.id} />}
        />
      )}
      {job.cancellation && <CancelledCard job={job} />}
      {job.noAccess && <NoAccessCard job={job} />}

      <Card
        title="Assignments"
        description={`${confirmed} of ${job.crewSize} ${job.crewSize === 1 ? "place" : "places"} Confirmed`}
      >
        {job.assignments.length > 0 && (
          <List aria-label="Assignments">
            {job.assignments.map((a) => (
              <ListItem
                key={a.id}
                id={a.id}
                title={a.staff.name}
                description={sinceOf(a)}
                end={
                  <>
                    {stateBadge[a.status]}
                    {job.status === "booked" && a.status !== "released" && (
                      <Remove job={job} assignment={a} />
                    )}
                  </>
                }
              />
            ))}
          </List>
        )}
        {job.status === "booked" && job.openPlaces > 0 && <OpenTo job={job} />}
        {job.status === "booked" && (
          <Offer key={job.assignments.length} job={job} />
        )}
      </Card>

      <JobReschedule job={job} />
      {job.cancelTerms && <CancelJob job={job} />}
    </div>
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
    <div className="flex flex-col gap-1 text-sm text-fg-muted">
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
    </div>
  );
}

function Offer({ job }: { job: OfficeJob }) {
  const [staffId, setStaffId] = useState<string | null>(null);
  const action = useAction("The place wasn't offered. Please try again.");

  if (job.openPlaces === 0) {
    return (
      <p className="text-sm text-fg-muted">
        Every place is held. Remove someone to open their place to other
        Cleaners.
      </p>
    );
  }
  if (job.cleaners.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        There's no other active Cleaner to offer a place to.
      </p>
    );
  }

  const offer = async () => {
    if (!staffId) {
      action.fail("Choose a Cleaner");
      return;
    }
    const name = job.cleaners.find((c) => c.id === staffId)?.name;
    await action.run(
      () => postJson(`/api/jobs/${job.id}/assignments`, { staffId }),
      `Place offered to ${name}`,
    );
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
        <Button type="submit" variant="secondary" isPending={action.isPending}>
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
