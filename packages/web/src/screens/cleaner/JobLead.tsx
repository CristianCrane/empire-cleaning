import type { ReactNode } from "react";
import { KeyRound, Phone } from "lucide-react";
import { DateTile, DetailsCard, Fact, linkStyles } from "@empire-cleaning/ui";
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

// the client's number, on the Job's day once it's theirs: on the page, and
// in Couldn't get in's sheet, where it's one of the two things to try
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

// how we get in, on the Job's day once it's theirs; what's said when
// nothing's written down
export function AccessFact({
  note,
  className,
}: {
  note: string | null;
  className?: string;
}) {
  const t = useShared();
  return (
    <Fact
      icon={KeyRound}
      label={t.howWeGetIn}
      className={className}
      value={
        <span className="whitespace-pre-line">
          {note ?? t.c.nothingWritten}
        </span>
      }
    />
  );
}
