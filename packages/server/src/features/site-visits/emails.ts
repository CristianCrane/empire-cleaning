import { formats } from "@empire-cleaning/models";
import {
  button,
  details,
  greeting,
  paragraph,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";

const { formatWhen } = formats.en;

// A Client is emailed when a Site Visit is booked, moved or cancelled; they
// ask for changes by phone
export type SiteVisitNotice = {
  name: string;
  address: string;
  startsAt: Date;
  // the Staff member coming, and for how long
  visitor: string;
  minutes: number;
  // a home, or business premises
  place: "home" | "premises";
};

const visitDetails = (
  { address, startsAt, visitor, minutes }: SiteVisitNotice,
  was?: Date,
) =>
  details([
    { label: "When", value: formatWhen(startsAt) },
    ...(was ? [{ label: "Was", value: formatWhen(was) }] : []),
    { label: "Where", value: address },
    { label: "Who", value: `${firstNameOf(visitor)} from Empire Cleaning` },
    { label: "Takes", value: `about ${minutes} minutes` },
  ]);

const accountButton = button("See it in your account", "/portal");

export const siteVisitBookedEmail = (visit: SiteVisitNotice): Email => ({
  subject: "Your site visit is booked",
  blocks: [
    greeting(firstNameOf(visit.name)),
    paragraph(
      `We've booked a free visit to see the ${visit.place} before we quote.`,
    ),
    visitDetails(visit),
    paragraph(
      "There's no charge. If the time doesn't suit you, please call us to change it.",
    ),
    accountButton,
  ],
});

// `was` is its time before, when it moved; without, only who or how long
// changed
export const siteVisitChangedEmail = (
  visit: SiteVisitNotice & { was?: Date },
): Email => ({
  subject: visit.was
    ? "Your site visit has moved"
    : "Your site visit has changed",
  blocks: [
    greeting(firstNameOf(visit.name)),
    paragraph(
      visit.was
        ? "We've moved your free site visit."
        : "We've changed your free site visit. It's still at the same time.",
    ),
    visitDetails(visit, visit.was),
    paragraph("If the time doesn't suit you, please call us to change it."),
    accountButton,
  ],
});

export const siteVisitCancelledEmail = ({
  name,
  address,
  startsAt,
}: {
  name: string;
  address: string;
  startsAt: Date;
}): Email => ({
  subject: "Your site visit is cancelled",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `We've cancelled your site visit at ${address} on ${formatWhen(startsAt)}.`,
    ),
    paragraph(
      "If you'd still like us to come and see it, please call us to book another.",
    ),
    accountButton,
  ],
});
