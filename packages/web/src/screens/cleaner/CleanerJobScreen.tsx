import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  CalendarClock,
  CirclePlus,
  Clock,
  KeyRound,
  Phone,
  Users,
} from "lucide-react";
import type { CleanerJob } from "@empire-cleaning/models";
import { RELEASE_CLOSED } from "@empire-cleaning/models";
import {
  ActionFooter,
  ActionRow,
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Heading,
  IconTile,
  Notice,
  Section,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { Fact } from "../Fact.tsx";
import {
  addressOf,
  dayOfInstant,
  formatDay,
  formatHours,
  formatTime,
} from "../format.ts";
import { CleanerJobBadge, directionsTo, untilAbout } from "./CleanerHome.tsx";
import { CompleteJob, Completed, NotYet } from "./CompleteJob.tsx";
import { NoAccessRecorded, RecordNoAccess } from "./NoAccess.tsx";

// One Job as its Cleaner sees it, never with prices (UX pass, #96): an Offer
// to them to Confirm or Release first; then its details, its time
// large, how to get in where it's seen at the door; and what to do now in a
// bar at the foot, in reach on site: Complete it, record No Access, or
// Release a Job they can't make.
export function CleanerJobScreen() {
  const job = useLoaderData({ from: "/cleaner/jobs/$jobId" });
  const offered = job.assignment.status === "offered";
  const open = !job.outcome;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            offered
              ? { label: "Offers", href: linkTo({ to: "/cleaner/offers" }) }
              : { label: "Your jobs", href: linkTo({ to: "/cleaner" }) },
            {
              label: `${formatDay(dayOfInstant(job.startsAt))}, ${formatTime(job.startsAt)}`,
            },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{job.serviceName}</Heading>
          <CleanerJobBadge job={job} />
        </div>
      </div>

      <NotYet job={job} />
      {open && !offered && !job.started && !job.assignment.canRelease && (
        <Notice>{RELEASE_CLOSED}</Notice>
      )}
      {offered && <TakeOffer job={job} />}
      {job.outcome === "completed" && <Completed job={job} />}
      {job.outcome === "no_access" && <NoAccessRecorded job={job} />}

      <JobDetails job={job} />

      {open &&
        !offered &&
        (job.canComplete ||
          job.canRecordNoAccess ||
          (!job.started && job.assignment.canRelease)) && (
          <ActionFooter aria-label="What to do">
            {!job.started && job.assignment.canRelease && (
              <Release job={job} label="Drop out of this job" />
            )}
            {job.canRecordNoAccess && <RecordNoAccess job={job} />}
            {job.canComplete && <CompleteJob job={job} />}
          </ActionFooter>
        )}
    </div>
  );
}

// the Job as its Cleaner reads it, as the Client's and the Office's pages
// do: when, large, then where with directions; how to get in on its own;
// then the facts across
function JobDetails({ job }: { job: CleanerJob }) {
  const unconfirmed = job.crew.filter((m) => m.status === "offered");
  const address = addressOf(job.property);

  return (
    <Section title="Job details">
      <Card>
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <IconTile icon={CalendarClock} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm text-fg-muted">
                {formatDay(dayOfInstant(job.startsAt))},{" "}
                {untilAbout(job.startsAt, job.hoursOnSite)}
              </p>
              <p className="text-3xl font-semibold text-fg tabular-nums">
                {formatTime(job.startsAt)}
              </p>
              <p className="text-fg [overflow-wrap:anywhere]">{address}</p>
              <a
                className="self-start font-semibold text-primary underline-offset-2 hover:underline"
                href={directionsTo(address)}
                target="_blank"
                rel="noreferrer"
              >
                Directions
              </a>
            </div>
          </div>
          <div className="flex gap-3 rounded-md bg-surface-sunken p-4">
            <KeyRound
              aria-hidden
              size={20}
              className="mt-0.5 shrink-0 text-fg-muted"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-semibold text-fg">How we get in</p>
              <p className="whitespace-pre-line text-fg [overflow-wrap:anywhere]">
                {job.property.accessInstructions ??
                  "Nothing's written down. Call the client when you get there."}
              </p>
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact
              icon={Clock}
              label="On site"
              value={`About ${formatHours(job.hoursOnSite)}`}
            />
            <Fact
              icon={CirclePlus}
              label="Add-ons"
              value={job.addOns.length > 0 ? job.addOns.join(", ") : "None"}
            />
            <Fact
              icon={Users}
              label="Crew"
              value={
                job.crew.length === 1
                  ? "Just you"
                  : job.crew.map((m) => m.name).join(", ")
              }
              line={
                unconfirmed.length > 0
                  ? `${unconfirmed.map((m) => m.name).join(", ")} not confirmed yet`
                  : job.crew.length > 1
                    ? "Crew, all confirmed"
                    : "Crew"
              }
            />
            <Fact
              icon={Phone}
              label="Client"
              value={
                job.client.phone ? (
                  <a
                    className="font-semibold text-primary"
                    href={`tel:${job.client.phone}`}
                  >
                    {job.client.firstName}, {job.client.phone}
                  </a>
                ) : (
                  job.client.firstName
                )
              }
              line={
                job.client.phone
                  ? "Client: tap to call"
                  : "Client: their number shows on the day"
              }
            />
          </dl>
        </div>
      </Card>
    </Section>
  );
}

// a Job the Office offered them: Confirm it, or let it go
function TakeOffer({ job }: { job: CleanerJob }) {
  // reloads on failure too, to show the new time if the Job moved
  const action = useAction("The job wasn't confirmed. Please try again.", {
    reloadOnFailure: true,
  });

  // sends the time they were shown, so a Job moved meanwhile isn't taken at
  // a time they never saw
  const confirm = () =>
    action.run(
      () =>
        postJson(`/api/assignments/${job.assignment.id}/confirm`, {
          startsAt: job.startsAt,
        }),
      "Job confirmed",
    );

  return (
    <Section title="Offered to you">
      <Card>
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <ActionRow
          actions={
            <>
              <Release job={job} label="Not for me" />
              <Button
                isPending={action.isPending}
                onPress={() => void confirm()}
              >
                Confirm
              </Button>
            </>
          }
        >
          <p>The office offered you this job. Can you make it?</p>
        </ActionRow>
      </Card>
    </Section>
  );
}

function Release({ job, label }: { job: CleanerJob; label: string }) {
  const navigate = useNavigate();
  const [problem, setProblem] = useState<string>();
  const [isPending, setPending] = useState(false);

  const release = async (close: () => void) => {
    setPending(true);
    setProblem(undefined);
    try {
      await postJson(`/api/assignments/${job.assignment.id}/release`);
      showToast({ tone: "success", title: "You've dropped out" });
      close();
      await navigate({ to: "/cleaner" });
    } catch (e) {
      setProblem(
        e instanceof ApiError && e.status === 409
          ? e.message
          : "You're still on this job. Please try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <DialogTrigger>
      <Button variant="secondary">{label}</Button>
      <Dialog title="Drop out of this job?" role="alertdialog">
        {({ close }) => (
          <>
            <p>
              It goes to the other cleaners free then, and the office is told.
              It won't be on your list any more.
            </p>
            {problem && <Notice tone="danger">{problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isPending={isPending}
                onPress={() => void release(close)}
              >
                Drop out
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}
