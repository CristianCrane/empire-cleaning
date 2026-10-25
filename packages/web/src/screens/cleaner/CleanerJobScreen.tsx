import { useState } from "react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import type { CleanerJob } from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Heading,
  Notice,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  cleanTypeLabel,
  formatDateTime,
  formatHours,
} from "../format.ts";
import { PlaceBadge } from "./CleanerHome.tsx";

// One Job as its Cleaner sees it: where, what, and who with, never prices.
// They Confirm or Release their place here.
export function CleanerJobScreen() {
  const job = useLoaderData({ from: "/cleaner/jobs/$jobId" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Your Jobs", href: linkTo({ to: "/cleaner" }) },
            { label: formatDateTime(job.startsAt) },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{formatDateTime(job.startsAt)}</Heading>
          <PlaceBadge job={job} />
        </div>
      </div>

      <YourPlace job={job} />

      <Card title="Where">
        <p>{addressOf(job.property)}</p>
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Access Instructions</span>
          <p className="whitespace-pre-line">
            {job.property.accessInstructions ?? "None given."}
          </p>
        </div>
      </Card>

      <Card title="The clean">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Clean</dt>
          <dd>{cleanTypeLabel[job.cleanType]}</dd>
          <dt className="font-semibold">Add-ons</dt>
          <dd>{job.addOns.length > 0 ? job.addOns.join(", ") : "None"}</dd>
          <dt className="font-semibold">Time on site</dt>
          <dd>About {formatHours(job.hoursOnSite)}</dd>
        </dl>
      </Card>

      <Card title="Who">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Client</dt>
          <dd>{job.client.firstName}</dd>
          <dt className="font-semibold">Phone</dt>
          <dd>{job.client.phone ?? "Shown here on the day of the Job"}</dd>
          <dt className="font-semibold">Crew</dt>
          <dd>
            <ul>
              {job.crew.map((member) => (
                <li key={member.name}>
                  {member.name}
                  {member.status === "offered" && " (not confirmed yet)"}
                </li>
              ))}
            </ul>
          </dd>
        </dl>
      </Card>
    </div>
  );
}

function YourPlace({ job }: { job: CleanerJob }) {
  const router = useRouter();
  const [problem, setProblem] = useState<string>();
  const [isPending, setPending] = useState(false);
  const { assignment } = job;

  const confirm = async () => {
    setPending(true);
    setProblem(undefined);
    try {
      await postJson(`/api/assignments/${assignment.id}/confirm`);
      showToast({ tone: "success", title: "Place confirmed" });
      await router.invalidate();
    } catch {
      setProblem("Your place wasn't confirmed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  if (assignment.status === "offered") {
    return (
      <Card title="Your place">
        <p>You've been offered a place on this Job. Can you make it?</p>
        {problem && <Notice tone="danger">{problem}</Notice>}
        <Actions>
          <Release job={job} />
          <Button isPending={isPending} onPress={() => void confirm()}>
            Confirm
          </Button>
        </Actions>
      </Card>
    );
  }

  return (
    <Card title="Your place">
      <p>You're confirmed for this Job.</p>
      {assignment.canRelease ? (
        <Actions>
          <Release job={job} />
        </Actions>
      ) : (
        <Notice>
          It's less than 48 hours until this Job, so your place can't be
          released here. If you can't make it, please call the Office.
        </Notice>
      )}
    </Card>
  );
}

function Release({ job }: { job: CleanerJob }) {
  const navigate = useNavigate();
  const [problem, setProblem] = useState<string>();
  const [isPending, setPending] = useState(false);

  const release = async (close: () => void) => {
    setPending(true);
    setProblem(undefined);
    try {
      await postJson(`/api/assignments/${job.assignment.id}/release`);
      showToast({ tone: "success", title: "Place released" });
      close();
      await navigate({ to: "/cleaner" });
    } catch (e) {
      setProblem(
        e instanceof ApiError && e.status === 409
          ? e.message
          : "Your place wasn't released. Please try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <DialogTrigger>
      <Button variant="secondary">Release</Button>
      <Dialog title="Release your place?" role="alertdialog">
        {({ close }) => (
          <>
            <p>
              The Office will be told, so they can offer it to someone else. The
              Job will no longer be in your list.
            </p>
            {problem && <Notice tone="danger">{problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isPending={isPending}
                onPress={() => void release(close)}
              >
                Release
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}
