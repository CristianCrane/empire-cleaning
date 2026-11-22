import type { ReactNode } from "react";
import { DateTile, DetailsCard } from "@empire-cleaning/ui";
import { endOf } from "../format.ts";
import { useShared } from "../words.ts";

// A Job's details card as a Cleaner reads it, an offer or theirs (#493's
// layout D): its day as a date tile, its times large, from its start to
// when it should be over, and where (the address once it's theirs, the ZIP
// code before); then its facts, ruled off
export function JobLead({
  job,
  where,
  children,
}: {
  job: { startsAt: string; hoursOnSite: number };
  where: string;
  children: ReactNode;
}) {
  const t = useShared();
  return (
    <DetailsCard
      label={t.c.jobDetails}
      tile={<DateTile date={job.startsAt} />}
      title={
        <span className="tabular-nums">
          {t.formatTimeRange(
            job.startsAt,
            endOf(job.startsAt, job.hoursOnSite),
          )}
        </span>
      }
      line={<span className="text-fg">{where}</span>}
    >
      {children}
    </DetailsCard>
  );
}
