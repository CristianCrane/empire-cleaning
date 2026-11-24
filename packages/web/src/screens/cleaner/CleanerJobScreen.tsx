import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  Check,
  CircleCheck,
  CirclePlus,
  Clock,
  Navigation,
  Phone,
  UserMinus,
  UserRound,
  X,
} from "lucide-react";
import {
  business,
  catalog,
  firstNameOf,
  howLong,
  type CleanerJob,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  CrewSection,
  Dialog,
  ExternalButtonLink,
  ExtrasSection,
  Fact,
  Facts,
  Fold,
  Notice,
  RecordPage,
  type DialogState,
  type PageAction,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction, useLeavingAction } from "../action.ts";
import { addressOf } from "../format.ts";
import { jobStatusIcon } from "../icons.ts";
import { type Said, useSaid } from "../words.ts";
import { CleanerJobBadge, directionsTo } from "./CleanerHome.tsx";
import { AccessFact, ClientNumberFact, JobLead } from "./JobLead.tsx";
import { CompleteJob, Completed, useNotYet } from "./CompleteJob.tsx";
import { NoAccessRecorded, RecordNoAccess } from "./NoAccess.tsx";

const words = catalog({
  en: {
    dropOut: "Drop out",
    client: "Client",
    theJob: "The job",
    notConfirmed: "The job wasn't confirmed. Please try again.",
    stillOn: "You're still on this job. Please try again.",
    droppedOut: "You've dropped out",
    dropOutTitle: "Drop out of this job?",
    dropOutText:
      "It goes to the other cleaners free then, and the office is told. It won't be on your list any more.",
    turnDownTitle: "Not for you?",
    turnDownText:
      "It goes to the other cleaners free then, and the office is told.",
    keepIt: "Keep it",
  },
  es: {
    dropOut: "Dejarlo",
    client: "Cliente",
    theJob: "El trabajo",
    notConfirmed: "El trabajo no se confirmó. Vuelve a intentarlo.",
    stillOn: "Sigues en este trabajo. Vuelve a intentarlo.",
    droppedOut: "Dejaste el trabajo",
    dropOutTitle: "¿Dejar este trabajo?",
    dropOutText:
      "Pasa a los otros limpiadores libres a esa hora, y se le avisa a la oficina. Ya no estará en tu lista.",
    turnDownTitle: "¿No es para ti?",
    turnDownText:
      "Pasa a los otros limpiadores libres a esa hora, y se le avisa a la oficina.",
    keepIt: "Conservarlo",
  },
});

// the nav section a Job is under, where its crumbs start: Offers while
// it's offered to them, Your jobs once it's theirs (AreaLayout lights it)
export type JobSection = "offers" | "yourJobs";
export const jobSection = (job: Pick<CleanerJob, "assignment">): JobSection =>
  job.assignment.status === "offered" ? "offers" : "yourJobs";

// the office's phone, for what only the office can sort out
const callOffice = (t: Said): PageAction => ({
  label: t.c.callOffice,
  icon: Phone,
  externalHref: business.phone.href,
});

// directions to where a Job is
const directionsAction = (t: Said, address: string): PageAction => ({
  label: t.c.directions,
  icon: Navigation,
  externalHref: directionsTo(address),
});

// One Job as its Cleaner sees it, a Record (docs/ux.md), never with prices
// (UX pass, #96), at each stage of it (#493's layout D): while it's offered,
// what they'd take on; once it's theirs, where too; once they've confirmed,
// on the day, the client's number and how we get in (#230, D3); once it's
// over, how it went first, the Job folded under it. One split button at
// every stage: Confirm while offered, Directions till it starts, then Mark
// done; the rest behind its arrow
export function CleanerJobScreen() {
  const job = useLoaderData({ from: "/cleaner/jobs/$jobId" });
  const offered = job.assignment.status === "offered";
  const t = useSaid(words);
  const { c, w } = t;
  const notYet = useNotYet(job);
  // a header's action, so why it failed is a toast; it reloads on failure
  // too, to show the new time if the Job moved
  const confirming = useAction(w.notConfirmed, {
    reloadOnFailure: true,
    toast: true,
  });

  // sends the time they were shown, so a Job moved meanwhile isn't taken at
  // a time they never saw
  const confirm = () =>
    void confirming.run(
      () =>
        postJson(`/api/assignments/${job.assignment.id}/confirm`, {
          startsAt: job.startsAt,
        }),
      c.jobConfirmed,
    );
  const release = (state: DialogState) => (
    <ReleaseDialog job={job} {...state} />
  );

  const { next, more }: { next?: PageAction; more: PageAction[] } = job.outcome
    ? { more: [] }
    : offered
      ? {
          next: {
            label: c.confirm,
            icon: Check,
            isPending: confirming.isPending,
            onAction: confirm,
          },
          more: [{ label: c.notForMe, icon: X, dialog: release }],
        }
      : job.started
        ? {
            // greyed while the rest of the crew hasn't confirmed: the
            // alert says why, and calls the office
            next: {
              label: c.markDone,
              icon: CircleCheck,
              isDisabled: !job.canComplete,
              dialog: (state) => <CompleteJob job={job} {...state} />,
            },
            more: [
              ...(job.canRecordNoAccess
                ? [
                    {
                      label: t.jobStatusLabel.no_access,
                      icon: jobStatusIcon.no_access,
                      dialog: (state: DialogState) => (
                        <RecordNoAccess job={job} {...state} />
                      ),
                    },
                  ]
                : []),
              ...(notYet ? [] : [callOffice(t)]),
            ],
          }
        : {
            next: directionsAction(t, addressOf(job.property)),
            // inside 48 hours it's the office's to sort out: Drop out is
            // absent, and Call the office is here
            more: [
              callOffice(t),
              ...(job.assignment.canRelease
                ? [
                    {
                      label: w.dropOut,
                      icon: UserMinus,
                      danger: true,
                      dialog: release,
                    },
                  ]
                : []),
            ],
          };

  const parts = (
    <>
      <JobDetails job={job} />
      <ExtrasSection title={t.extras} extras={job.addOns} />
      <CrewSection
        title={c.crew}
        size={job.crewSize}
        members={crewOf(t, job)}
      />
    </>
  );
  return (
    <RecordPage
      trail={[
        jobSection(job) === "offers"
          ? { label: c.offers, href: linkTo({ to: "/cleaner/offers" }) }
          : { label: c.yourJobs, href: linkTo({ to: "/cleaner" }) },
        { label: t.formatDateTime(job.startsAt) },
      ]}
      title={job.serviceName}
      status={<CleanerJobBadge job={job} />}
      next={next}
      actions={more}
      alerts={[
        notYet && {
          ...notYet,
          action: (
            <ExternalButtonLink variant="text" href={business.phone.href}>
              {c.callOffice}
            </ExternalButtonLink>
          ),
        },
      ]}
    >
      {job.outcome ? (
        <>
          {job.outcome === "completed" && <Completed job={job} />}
          {job.outcome === "no_access" && <NoAccessRecorded job={job} />}
          <Fold label={w.theJob}>
            <div className="flex flex-col gap-6">{parts}</div>
          </Fold>
        </>
      ) : (
        parts
      )}
    </RecordPage>
  );
}

// the crew as this Cleaner sees it: themselves first, as "You", once
// they've confirmed (till then they're one of those still needed, like
// any other), the rest by their first names
const crewOf = (t: Said, job: CleanerJob) =>
  job.crew
    .filter((m) => !(m.you && m.status === "offered"))
    .sort((a, b) => Number(b.you) - Number(a.you))
    .map((m) => ({
      name: m.you ? t.c.you : firstNameOf(m.name),
      confirmed: m.status === "confirmed",
    }));

// the Job's details: when and where (JobLead), then a fact each: how long,
// the client; once they've confirmed, on the day, their number; how many
// extras, the signpost to their list below; and, confirmed and on the day,
// how we get in, last and the card's width, so a long note never pushes the
// short facts down
function JobDetails({ job }: { job: CleanerJob }) {
  const t = useSaid(words);
  const { w } = t;
  // what the server holds back until they've confirmed and it's the day
  // (#230, D3): drawn as it comes, the server's rule, never a copy of it here
  const { onTheDay } = job;
  return (
    <JobLead job={job} where={addressOf(job.property)}>
      <Facts>
        <Fact
          icon={Clock}
          label={t.howLong}
          value={howLong(t, job.hoursOnSite)}
        />
        <Fact icon={UserRound} label={w.client} value={job.client.firstName} />
        {onTheDay && <ClientNumberFact phone={onTheDay.phone} />}
        {job.addOns.length > 0 && (
          <Fact
            icon={CirclePlus}
            label={t.extras}
            value={t.formatNumber(job.addOns.length)}
          />
        )}
        {onTheDay && (
          <AccessFact
            note={onTheDay.accessInstructions}
            className="col-span-full"
          />
        )}
      </Facts>
    </JobLead>
  );
}

// letting it go, the same Release to the office: dropping out of a Job
// they'd confirmed, which is red, as they can't take it back; or saying an
// offer's not for them, which the office can offer again, so isn't
function ReleaseDialog({
  job,
  ...state
}: { job: CleanerJob } & Partial<DialogState>) {
  const navigate = useNavigate();
  const { c, w } = useSaid(words);
  const offer = job.assignment.status === "offered";
  const action = useLeavingAction(w.stillOn);

  const release = (close: () => void) =>
    action.run(
      async () => {
        await postJson(`/api/assignments/${job.assignment.id}/release`);
        close();
        await navigate({ to: offer ? "/cleaner/offers" : "/cleaner" });
      },
      offer ? c.takenOff : w.droppedOut,
    );

  return (
    <Dialog
      title={offer ? w.turnDownTitle : w.dropOutTitle}
      role="alertdialog"
      {...state}
    >
      {({ close }) => (
        <>
          <p>{offer ? w.turnDownText : w.dropOutText}</p>
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            <Button variant="quiet" onPress={close}>
              {w.keepIt}
            </Button>
            <Button
              variant={offer ? "primary" : "danger"}
              isPending={action.isPending}
              onPress={() => void release(close)}
            >
              {offer ? c.notForMe : w.dropOut}
            </Button>
          </Actions>
        </>
      )}
    </Dialog>
  );
}
