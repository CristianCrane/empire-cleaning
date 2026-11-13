import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  CalendarClock,
  CirclePlus,
  Clock,
  KeyRound,
  Phone,
  Users,
  DoorClosed,
  UserMinus,
} from "lucide-react";
import { catalog, type CleanerJob } from "@empire-cleaning/models";
import {
  ActionRow,
  Actions,
  Button,
  Card,
  Dialog,
  IconTile,
  Notice,
  Section,
  Fact,
  RecordPage,
  DetailsCard,
  Facts,
  type DialogState,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction, useLeavingAction } from "../action.ts";
import { addressOf, dayOfInstant, formatHours } from "../format.ts";
import { useSaid } from "../words.ts";
import { CleanerJobBadge, directionsTo, untilAbout } from "./CleanerHome.tsx";
import { CompleteJob, Completed, useNotYet } from "./CompleteJob.tsx";
import { NoAccessRecorded, RecordNoAccess } from "./NoAccess.tsx";

const words = catalog({
  en: {
    whatToDo: "What to do",
    dropOutOfJob: "Drop out of this job",
    nothingWritten:
      "Nothing's written down. Call the client when you get there.",
    notConfirmedYet: (names: string) => `${names} not confirmed yet`,
    allConfirmed: "Crew, all confirmed",
    client: "Client",
    tapToCall: "Client: tap to call",
    numberOnTheDay: "Client: their number shows on the day",
    notConfirmed: "The job wasn't confirmed. Please try again.",
    canYouMakeIt: "The office offered you this job. Can you make it?",
    stillOn: "You're still on this job. Please try again.",
    droppedOut: "You've dropped out",
    dropOutTitle: "Drop out of this job?",
    dropOutText:
      "It goes to the other cleaners free then, and the office is told. It won't be on your list any more.",
    keepIt: "Keep it",
    dropOut: "Drop out",
  },
  es: {
    whatToDo: "Qué hacer",
    dropOutOfJob: "Dejar este trabajo",
    nothingWritten: "No hay nada escrito. Llama al cliente cuando llegues.",
    notConfirmedYet: (names: string) => `${names}: aún sin confirmar`,
    allConfirmed: "Equipo, todos confirmados",
    client: "Cliente",
    tapToCall: "Cliente: toca para llamar",
    numberOnTheDay: "Cliente: su número aparece ese día",
    notConfirmed: "El trabajo no se confirmó. Vuelve a intentarlo.",
    canYouMakeIt: "La oficina te ofreció este trabajo. ¿Puedes ir?",
    stillOn: "Sigues en este trabajo. Vuelve a intentarlo.",
    droppedOut: "Dejaste el trabajo",
    dropOutTitle: "¿Dejar este trabajo?",
    dropOutText:
      "Pasa a los otros limpiadores libres a esa hora, y se le avisa a la oficina. Ya no estará en tu lista.",
    keepIt: "Conservarlo",
    dropOut: "Dejarlo",
  },
});

// One Job as its Cleaner sees it, a Record (docs/ux.md), never with
// prices (UX pass, #96): its details, its time large, how to get in; an
// Offer to them to Confirm or Release; dropping out or recording No Access
// as the page's actions; and Complete in a bar at the foot, in reach on site
export function CleanerJobScreen() {
  const job = useLoaderData({ from: "/cleaner/jobs/$jobId" });
  const offered = job.assignment.status === "offered";
  const open = !job.outcome;
  const t = useSaid(words);
  const { c, w } = t;
  const notYet = useNotYet(job);
  const canRelease =
    open && !offered && !job.started && job.assignment.canRelease;
  return (
    <RecordPage
      trail={[
        offered
          ? { label: c.offers, href: linkTo({ to: "/cleaner/offers" }) }
          : { label: c.yourJobs, href: linkTo({ to: "/cleaner" }) },
        {
          label: `${t.formatDay(dayOfInstant(job.startsAt))}, ${t.formatTime(job.startsAt)}`,
        },
      ]}
      title={job.serviceName}
      status={<CleanerJobBadge job={job} />}
      actions={[
        open &&
          !offered &&
          job.canRecordNoAccess && {
            label: t.jobStatusLabel.no_access,
            icon: DoorClosed,
            dialog: (state) => <RecordNoAccess job={job} {...state} />,
          },
        canRelease && {
          label: w.dropOutOfJob,
          icon: UserMinus,
          danger: true,
          dialog: (state) => <ReleaseDialog job={job} {...state} />,
        },
      ]}
      alerts={[
        notYet,
        open &&
          !offered &&
          !job.started &&
          !job.assignment.canRelease && {
            key: "release closed",
            children: t.RELEASE_CLOSED,
          },
      ]}
      details={<JobDetails job={job} />}
      footer={
        open && !offered && job.canComplete
          ? { label: w.whatToDo, children: <CompleteJob job={job} /> }
          : undefined
      }
    >
      {offered && <TakeOffer job={job} />}
      {job.outcome === "completed" && <Completed job={job} />}
      {job.outcome === "no_access" && <NoAccessRecorded job={job} />}
    </RecordPage>
  );
}

// the Job as its Cleaner reads it, as the Client's and the Office's pages
// do: when, large, then where with directions; how to get in; then the facts
function JobDetails({ job }: { job: CleanerJob }) {
  const unconfirmed = job.crew.filter((m) => m.status === "offered");
  const address = addressOf(job.property);
  const t = useSaid(words);
  const { c, w } = t;
  return (
    <DetailsCard
      label={c.jobDetails}
      tile={<IconTile icon={CalendarClock} size="lg" />}
      kicker={`${t.formatDay(dayOfInstant(job.startsAt))}, ${untilAbout(t, job.startsAt, job.hoursOnSite)}`}
      title={<span className="tabular-nums">{t.formatTime(job.startsAt)}</span>}
      line={
        <>
          <span className="block text-fg">{address}</span>
          <a
            className="font-semibold text-primary underline-offset-2 hover:underline"
            href={directionsTo(address)}
            target="_blank"
            rel="noreferrer"
          >
            {c.directions}
          </a>
        </>
      }
    >
      <Facts>
        <Fact
          icon={KeyRound}
          label={t.howWeGetIn}
          value={
            <span className="whitespace-pre-line">
              {job.property.accessInstructions ?? w.nothingWritten}
            </span>
          }
          className="col-span-full"
        />
        <Fact
          icon={Clock}
          label={t.onSite}
          value={t.about(formatHours(job.hoursOnSite))}
        />
        <Fact
          icon={CirclePlus}
          label={t.extras}
          value={job.addOns.length > 0 ? t.formatList(job.addOns) : t.none}
        />
        <Fact
          icon={Users}
          label={c.crew}
          value={
            job.crew.length === 1
              ? c.justYou
              : t.formatList(job.crew.map((m) => m.name))
          }
          line={
            unconfirmed.length > 0
              ? w.notConfirmedYet(t.formatList(unconfirmed.map((m) => m.name)))
              : job.crew.length > 1
                ? w.allConfirmed
                : c.crew
          }
        />
        <Fact
          icon={Phone}
          label={w.client}
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
          line={job.client.phone ? w.tapToCall : w.numberOnTheDay}
        />
      </Facts>
    </DetailsCard>
  );
}

// a Job the Office offered them: Confirm it, or let it go
function TakeOffer({ job }: { job: CleanerJob }) {
  const t = useSaid(words);
  const { c, w } = t;
  // reloads on failure too, to show the new time if the Job moved
  const action = useAction(w.notConfirmed, {
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
      c.jobConfirmed,
    );

  return (
    <Section title={c.offeredToYou}>
      <Card>
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <ActionRow
          actions={
            <>
              <Release job={job} label={c.notForMe} />
              <Button
                isPending={action.isPending}
                onPress={() => void confirm()}
              >
                {c.confirm}
              </Button>
            </>
          }
        >
          <p>{w.canYouMakeIt}</p>
        </ActionRow>
      </Card>
    </Section>
  );
}

// dropping out: a page action's dialog, or Release's
function ReleaseDialog({ job, ...state }: { job: CleanerJob } & DialogState) {
  const navigate = useNavigate();
  const { w } = useSaid(words);
  // it leaves for Your jobs
  const action = useLeavingAction(w.stillOn);

  const release = (close: () => void) =>
    action.run(async () => {
      await postJson(`/api/assignments/${job.assignment.id}/release`);
      close();
      await navigate({ to: "/cleaner" });
    }, w.droppedOut);

  return (
    <Dialog title={w.dropOutTitle} role="alertdialog" {...state}>
      {({ close }) => (
        <>
          <p>{w.dropOutText}</p>
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            <Button variant="quiet" onPress={close}>
              {w.keepIt}
            </Button>
            <Button
              variant="danger"
              isPending={action.isPending}
              onPress={() => void release(close)}
            >
              {w.dropOut}
            </Button>
          </Actions>
        </>
      )}
    </Dialog>
  );
}

// the same, from its own button: on the Offer, "Not for me"
function Release({ job, label }: { job: CleanerJob; label: string }) {
  const [isOpen, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onPress={() => setOpen(true)}>
        {label}
      </Button>
      <ReleaseDialog job={job} isOpen={isOpen} onOpenChange={setOpen} />
    </>
  );
}
