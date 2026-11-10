import { catalog } from "@empire-cleaning/models";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import {
  DateTile,
  EmptyState,
  Heading,
  List,
  ListItem,
  Section,
} from "@empire-cleaning/ui";
import { formatHours } from "../format.ts";
import { AssignmentStateBadge } from "../JobBadges.tsx";
import { useSaid } from "../words.ts";
import { crewSizeOf } from "./CleanerNeededScreen.tsx";

const words = catalog({
  en: {
    pickedYou:
      "The office picked you for these. Confirm, or let them go to someone else.",
    openToYou: "Open to you",
    openText:
      "Jobs in the next 7 days that need a cleaner while you're free. The first to confirm gets each one.",
    nothingOpen: "Nothing open to you right now",
    nothingOpenText:
      "When a job needs someone while you're free, it shows here. Jobs the office offers you show at the top.",
  },
  es: {
    pickedYou:
      "La oficina te eligió para estos. Confírmalos, o deja que pasen a otra persona.",
    openToYou: "Disponibles para ti",
    openText:
      "Trabajos de los próximos 7 días que necesitan un limpiador mientras estás libre. El primero que confirme se queda con cada uno.",
    nothingOpen: "Ahora no hay nada disponible para ti",
    nothingOpenText:
      "Cuando un trabajo necesite a alguien mientras estás libre, aparecerá aquí. Los que te ofrezca la oficina aparecen arriba.",
  },
});

// Jobs that aren't the Cleaner's yet, apart from Your Jobs so their own
// list says only where they're working (UX pass, #96): those the Office
// offered them, to Confirm or Release, and those open to them (ADR-0019),
// first come first served.
export function CleanerOffers() {
  const { offered, open } = useLoaderData({ from: "/cleaner/offers" });
  const navigate = useNavigate();
  const t = useSaid(words);
  const { c, w } = t;

  return (
    <div className="flex flex-col gap-6">
      <Heading level={1} inBar>
        {c.offers}
      </Heading>

      {offered.length > 0 && (
        <Section title={c.offeredToYou} description={w.pickedYou}>
          <List
            aria-label={c.offeredToYou}
            onAction={(id) =>
              navigate({
                to: "/cleaner/jobs/$jobId",
                params: { jobId: String(id) },
              })
            }
          >
            {offered.map((job) => (
              <ListItem
                key={job.id}
                id={job.id}
                start={<DateTile date={job.startsAt} size="sm" />}
                title={t.formatDateTime(job.startsAt)}
                description={`${job.property.postcode} · ${job.serviceName}, ${formatHours(job.hoursOnSite)}`}
                end={<AssignmentStateBadge state="offered" />}
              />
            ))}
          </List>
        </Section>
      )}

      <Section title={w.openToYou} description={w.openText}>
        {open.length > 0 ? (
          <List
            aria-label={w.openToYou}
            onAction={(id) =>
              navigate({
                to: "/cleaner/open/$jobId",
                params: { jobId: String(id) },
              })
            }
          >
            {open.map((job) => (
              <ListItem
                key={job.jobId}
                id={job.jobId}
                start={<DateTile date={job.startsAt} size="sm" />}
                title={t.formatDateTime(job.startsAt)}
                description={[
                  job.postcode,
                  job.serviceName,
                  c.hoursOnSite(formatHours(job.hoursOnSite)),
                  crewSizeOf(t, job),
                ].join(" · ")}
              />
            ))}
          </List>
        ) : (
          <EmptyState
            headingLevel={3}
            icon={Inbox}
            title={w.nothingOpen}
            description={w.nothingOpenText}
          />
        )}
      </Section>
    </div>
  );
}
