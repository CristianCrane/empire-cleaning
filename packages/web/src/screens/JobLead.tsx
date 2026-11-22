import type { ReactNode } from "react";
import { Phone } from "lucide-react";
import {
  DateTile,
  DetailsCard,
  Fact,
  Fold,
  linkStyles,
} from "@empire-cleaning/ui";
import { endOf } from "./format.ts";
import { useShared } from "./words.ts";

// A Job's details card, as the Cleaner and the Office read it (#493's
// layout D): its day as a date tile, its times large, from its start to
// when it should be over, and where (the Cleaner's: the address once it's
// theirs, the ZIP code before); then its facts, ruled off
export function JobLead({
  job,
  where,
  children,
}: {
  job: { startsAt: string; hoursOnSite: number };
  where: ReactNode;
  children?: ReactNode;
}) {
  const t = useShared();
  return (
    <DetailsCard
      label={t.jobDetails}
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

// A Job that's over: what happened leads, above this, and the rest of the
// Job folds under `label`, there when it's wanted (#493)
export function JobFold({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Fold label={label}>
      <div className="flex flex-col gap-6">{children}</div>
    </Fold>
  );
}

// the client's number, to the Cleaner on the Job's day (#230): on the page,
// and in Couldn't get in's sheet, where it's one of the two things to try
export function ClientNumberFact({ phone }: { phone: string }) {
  const t = useShared();
  return (
    <Fact
      icon={Phone}
      label={t.c.clientsNumber}
      value={
        <a className={`${linkStyles()} tabular-nums`} href={`tel:${phone}`}>
          {phone}
        </a>
      }
    />
  );
}
