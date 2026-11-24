import type { LucideIcon } from "lucide-react";
import {
  AnswerCard,
  ButtonLink,
  DateTile,
  IconTile,
  type Alert,
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
  // the page's primary, or outlined when it asks nothing of them, only a
  // way to see it (a payment we try again ourselves)
  action?: { label: string; href: AppHref; secondary?: boolean };
};

// why the answer is what it is, when that needs saying (a payment late, a
// plan paused): an alert above the card, its tone the state's
export type Why = {
  tone: "info" | "warning" | "danger";
  lead: string;
  more?: string;
};

export const whyAlert = (why: Why | undefined): Alert | false =>
  !!why && {
    key: "why",
    tone: why.tone,
    children: (
      <p>
        <strong>{why.lead}</strong>
        {why.more && ` ${why.more}`}
      </p>
    ),
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
          <ButtonLink
            href={hero.action.href}
            variant={hero.action.secondary ? "secondary" : "primary"}
          >
            {hero.action.label}
          </ButtonLink>
        )
      }
    />
  );
}
