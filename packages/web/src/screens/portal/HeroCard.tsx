import type { LucideIcon } from "lucide-react";
import {
  AnswerCard,
  ButtonLink,
  DateTile,
  IconTile,
  type StatusTone,
} from "@empire-cleaning/ui";
import type { AppHref } from "../../links.ts";

// A Client's Home answer (whats-next.ts) or Payments' (payments.ts), as
// the card that says it: behind a DateTile when it's booked, else an
// IconTile in its tone
export type Hero = {
  label: string;
  icon: LucideIcon;
  tone: StatusTone;
  // when it is, for its calendar tile; none with nothing booked
  startsAt?: string;
  // the answer, large
  headline: string;
  lines: string[];
  action?: { label: string; href: AppHref };
};

export function HeroCard({ hero }: { hero: Hero }) {
  return (
    <AnswerCard
      tile={
        hero.startsAt ? (
          <DateTile date={hero.startsAt} />
        ) : (
          <IconTile icon={hero.icon} tone={hero.tone} size="lg" />
        )
      }
      label={hero.label}
      headline={hero.headline}
      lines={hero.lines}
      actions={
        hero.action && (
          <ButtonLink href={hero.action.href}>{hero.action.label}</ButtonLink>
        )
      }
    />
  );
}
