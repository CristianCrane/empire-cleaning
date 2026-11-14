import { catalog } from "@empire-cleaning/models";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { ListPage, type ListRow } from "@empire-cleaning/ui";
import { formatHours } from "../format.ts";
import { tabShown, useListUrl } from "../list-search.ts";
import { useSaid } from "../words.ts";
import { crewSizeOf } from "./CleanerNeededScreen.tsx";

const words = catalog({
  en: {
    openToYou: "Open to you",
    noneOffered: "Nothing offered to you.",
    noneOpen: "Nothing open to you in the next 7 days.",
    nothingOpen: "Nothing open to you right now",
  },
  es: {
    openToYou: "Disponibles para ti",
    noneOffered: "No te ofrecieron nada.",
    noneOpen: "No hay nada disponible para ti en los próximos 7 días.",
    nothingOpen: "Ahora no hay nada disponible para ti",
  },
});

// the list's Tabs: what the Office picked them for, then what's open
export const offerTabs = ["offered", "open"] as const;
type OfferTab = (typeof offerTabs)[number];

// Jobs that aren't the Cleaner's yet (#96, #433), apart from Your Jobs so
// their own list says only where they're working, a List by when, each led
// by roughly where: those the Office offered them, to Confirm or Release on
// the Job, and those open to them in the next 7 days (ADR-0019), first come
// first served, as each one says
export function CleanerOffers() {
  const { offered, open } = useLoaderData({ from: "/cleaner/offers" });
  const url = useListUrl<OfferTab>();
  const navigate = useNavigate();
  const t = useSaid(words);
  const { c, w } = t;
  const count = (tab: OfferTab) =>
    tab === "offered" ? offered.length : open.length;
  const tab = tabShown(offerTabs, url.tab, count);

  type Offer = (typeof offered)[number] | (typeof open)[number];
  const row = (job: Offer): ListRow =>
    "jobId" in job
      ? {
          id: job.jobId,
          at: job.startsAt,
          title: job.postcode,
          description: [
            job.serviceName,
            c.hoursOnSite(formatHours(job.hoursOnSite)),
            crewSizeOf(t, job),
          ].join(" · "),
          onOpen: () =>
            void navigate({
              to: "/cleaner/open/$jobId",
              params: { jobId: job.jobId },
            }),
        }
      : {
          id: job.id,
          at: job.startsAt,
          title: job.property.postcode,
          description: `${job.serviceName} · ${c.hoursOnSite(formatHours(job.hoursOnSite))}`,
          onOpen: () =>
            void navigate({
              to: "/cleaner/jobs/$jobId",
              params: { jobId: job.id },
            }),
        };

  return (
    <ListPage<Offer>
      title={c.offers}
      tabs={[
        {
          id: "offered",
          label: c.offeredToYou,
          count: offered.length,
          none: w.noneOffered,
        },
        {
          id: "open",
          label: w.openToYou,
          count: open.length,
          none: w.noneOpen,
        },
      ]}
      tab={tab}
      onTabChange={url.onTabChange}
      items={tab === "offered" ? offered : open}
      row={row}
      empty={{ icon: Inbox, title: w.nothingOpen }}
    />
  );
}
