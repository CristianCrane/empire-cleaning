import { catalog } from "@empire-cleaning/models";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import type { CleanerNeeded } from "@empire-cleaning/models";
import { CalendarClock, Clock, MapPin, Users } from "lucide-react";
import {
  ActionRow,
  Breadcrumbs,
  Button,
  Card,
  Heading,
  IconTile,
  Notice,
  Section,
  StatusBadge,
  Fact,
} from "@empire-cleaning/ui";
import { getJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useLeavingAction } from "../action.ts";
import { dayOfInstant, formatHours } from "../format.ts";
import { reportUnexpected } from "../../monitoring.ts";
import { type Said, useSaid } from "../words.ts";
import { untilAbout } from "./CleanerHome.tsx";

const words = catalog({
  en: {
    open: "Open",
    area: "Area",
    areaLine: "Area: the address shows once it's yours",
    didntWork: "That didn't work. Please try again.",
    takenOff: "Taken off your list",
    needsYou:
      "It needs a cleaner, and you're free then. The first to confirm gets it, and then sees the address, how we get in and the client.",
  },
  es: {
    open: "Disponible",
    area: "Zona",
    areaLine: "Zona: la dirección aparece cuando sea tuyo",
    didntWork: "No funcionó. Vuelve a intentarlo.",
    takenOff: "Quitado de tu lista",
    needsYou:
      "Necesita un limpiador, y estás libre a esa hora. El primero que lo confirme se lo queda, y entonces ve la dirección, cómo entramos y el cliente.",
  },
});

// "Just you", "2 cleaners"
export const crewSizeOf = (t: Said, job: Pick<CleanerNeeded, "crewSize">) =>
  job.crewSize === 1 ? t.c.justYou : t.cleaners(job.crewSize);

// A Cleaner Needed as a Cleaner it's open to sees it (ADR-0019): what, when,
// for how long and roughly where. They Confirm it, first come first served,
// or say it's not for them. The address, Access Instructions and Client
// come once they've taken it.
export function CleanerNeededScreen() {
  const job = useLoaderData({ from: "/cleaner/open/$jobId" });
  const t = useSaid(words);
  const { c, w } = t;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: c.offers, href: linkTo({ to: "/cleaner/offers" }) },
            { label: t.formatDateTime(job.startsAt) },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{job.serviceName}</Heading>
          <StatusBadge tone="info">{w.open}</StatusBadge>
        </div>
      </div>

      <TakeIt job={job} />

      <Section title={c.jobDetails}>
        <Card>
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <IconTile icon={CalendarClock} size="lg" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm text-fg-muted">
                  {t.formatDay(dayOfInstant(job.startsAt))},{" "}
                  {untilAbout(t, job.startsAt, job.hoursOnSite)}
                </p>
                <p className="text-3xl font-semibold text-fg tabular-nums">
                  {t.formatTime(job.startsAt)}
                </p>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              <Fact
                icon={Clock}
                label={t.onSite}
                value={t.about(formatHours(job.hoursOnSite))}
              />
              <Fact icon={Users} label={c.crew} value={crewSizeOf(t, job)} />
              <Fact
                icon={MapPin}
                label={w.area}
                value={job.postcode}
                line={w.areaLine}
              />
            </dl>
          </div>
        </Card>
      </Section>
    </div>
  );
}

function TakeIt({ job }: { job: CleanerNeeded }) {
  const navigate = useNavigate();
  const router = useRouter();
  const { c, w } = useSaid(words);
  // neither reloads this page: once taken or passed, it isn't open to them
  const action = useLeavingAction(w.didntWork);

  const answer = (which: "confirm" | "pass") =>
    action.run(
      async () => {
        try {
          // Confirm sends the time they were shown, so a Job moved
          // meanwhile isn't taken at a time they never saw
          await postJson(
            `/api/assignments/open/${job.jobId}/${which}`,
            which === "confirm" ? { startsAt: job.startsAt } : undefined,
          );
        } catch (e) {
          // shows the new time if the Job moved; if it's no longer open to
          // them, the page stays, with why
          const stillOpen = await getJson<CleanerNeeded>(
            `/api/assignments/open/${job.jobId}`,
          ).then(
            () => true,
            (e: unknown) => {
              reportUnexpected(e);
              return false;
            },
          );
          if (stillOpen) await router.invalidate();
          throw e;
        }
        await (which === "confirm"
          ? navigate({
              to: "/cleaner/jobs/$jobId",
              params: { jobId: job.jobId },
            })
          : navigate({ to: "/cleaner/offers" }));
      },
      which === "confirm" ? c.jobConfirmed : w.takenOff,
      which,
    );
  const { problem, pending } = action;

  return (
    <Section title={c.canYouTakeIt}>
      <Card>
        {problem && <Notice tone="danger">{problem}</Notice>}
        <ActionRow
          actions={
            <>
              <Button
                variant="secondary"
                isPending={pending === "pass"}
                isDisabled={pending === "confirm"}
                onPress={() => void answer("pass")}
              >
                {c.notForMe}
              </Button>
              <Button
                isPending={pending === "confirm"}
                isDisabled={pending === "pass"}
                onPress={() => void answer("confirm")}
              >
                {c.confirm}
              </Button>
            </>
          }
        >
          <p>{w.needsYou}</p>
        </ActionRow>
      </Card>
    </Section>
  );
}
