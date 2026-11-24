import { catalog } from "@empire-cleaning/models";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import type { CleanerNeeded } from "@empire-cleaning/models";
import { Check, Clock, Users, X } from "lucide-react";
import { Fact, Facts, RecordPage } from "@empire-cleaning/ui";
import { getJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useLeavingAction } from "../action.ts";
import { howLong } from "../format.ts";
import { reportUnexpected } from "../../monitoring.ts";
import { type Said, useSaid } from "../words.ts";
import { AvailableBadge } from "./CleanerHome.tsx";
import { JobLead } from "../JobLead.tsx";

const words = catalog({
  en: {
    zip: (postcode: string) => `ZIP code ${postcode}`,
    didntWork: "That didn't work. Please try again.",
  },
  es: {
    zip: (postcode: string) => `Código postal ${postcode}`,
    didntWork: "No funcionó. Vuelve a intentarlo.",
  },
});

// "Just you", "2 cleaners"
export const crewSizeOf = (t: Said, job: Pick<CleanerNeeded, "crewSize">) =>
  job.crewSize === 1 ? t.c.justYou : t.cleaners(job.crewSize);

// A Cleaner Needed as a Cleaner it's open to sees it (ADR-0019): what, when,
// for how long and roughly where (its ZIP code), and how many it takes,
// never who: its Client or its crew (GLOSSARY.md, Cleaner Needed). Confirm,
// first come first served, or Not for me, as the page's split button
// (#493's layout D). The address and the Client come once they've taken
// it, how we get in on the Job's day (#230).
export function CleanerNeededScreen() {
  const job = useLoaderData({ from: "/cleaner/open/$jobId" });
  const navigate = useNavigate();
  const router = useRouter();
  const t = useSaid(words);
  const { c, w } = t;
  // neither reloads this page: once taken or passed, it isn't open to
  // them. A header's action, so why it failed is a toast
  const action = useLeavingAction(w.didntWork, { toast: true });

  const answer = (which: "confirm" | "pass") =>
    void action.run(
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
          // them, the page stays, the toast saying why
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
      which === "confirm" ? c.jobConfirmed : c.takenOff,
      which,
    );

  return (
    <RecordPage
      trail={[
        { label: c.offers, href: linkTo({ to: "/cleaner/offers" }) },
        { label: t.formatDateTime(job.startsAt) },
      ]}
      title={job.serviceName}
      status={<AvailableBadge />}
      next={{
        label: c.confirm,
        icon: Check,
        isPending: action.pending === "confirm",
        isDisabled: action.pending === "pass",
        onAction: () => answer("confirm"),
      }}
      actions={[
        {
          label: c.notForMe,
          icon: X,
          isPending: action.pending === "pass",
          isDisabled: action.pending === "confirm",
          onAction: () => answer("pass"),
        },
      ]}
    >
      <JobLead job={job} where={w.zip(job.postcode)}>
        <Facts>
          <Fact
            icon={Clock}
            label={t.howLong}
            value={howLong(t, job.hoursOnSite)}
          />
          <Fact icon={Users} label={c.crew} value={crewSizeOf(t, job)} />
        </Facts>
      </JobLead>
    </RecordPage>
  );
}
