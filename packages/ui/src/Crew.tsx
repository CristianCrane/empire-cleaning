import { Check, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "./Avatar.tsx";
import { Card } from "./Card.tsx";
import { useUiWords } from "./language.ts";
import { Section } from "./Section.tsx";

// someone on a Job's crew: their name as this reader calls them ("You",
// "Dee"), their picture if any, whether they've confirmed, and what this
// reader can do about them, if anything (the Office's ✕ to take them off)
export type CrewMember = {
  name: string;
  confirmed: boolean;
  picture?: string | null;
  action?: ReactNode;
};

// An open place on a crew: a ghost of a face, its person faint and thin in
// a dashed ring with no fill, so it reads as someone still needed, not an
// empty circle (the `ui` skill, "A picture, not a paragraph"); the face's
// size, so a row of places lines up
export function OpenMark() {
  const words = useUiWords();
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border-strong text-fg-muted"
      >
        <UserRound size={22} strokeWidth={1.5} className="opacity-60" />
      </span>
      <span className="text-fg-muted">
        {words.open}
        <span className="sr-only">, {words.placeOpen}</span>
      </span>
    </span>
  );
}

// One person on a crew: every face the same, a green tick on it once
// they've confirmed and nothing till then: the tick says it once, so no
// word beside it but for a screen reader
export function CrewFace({ member }: { member: CrewMember }) {
  const words = useUiWords();
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative">
        <Avatar src={member.picture} />
        {member.confirmed && (
          <span
            aria-hidden
            className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-success-strong text-surface ring-2 ring-surface"
          >
            <Check size={13} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="font-semibold text-fg">
        {member.name}
        <span className="sr-only">
          , {member.confirmed ? words.confirmed : words.notConfirmedYet}
        </span>
      </span>
      {member.action}
    </span>
  );
}

// A Job's crew, a part of its own (a Section titled `title`, "Crew"): a
// line saying where it stands ("1 of 2 confirmed, 1 open"), then a face
// for each member and a ghost for each place still open, in a card. `size`
// is how many the Job takes; `actions` sit on its title's line
export function CrewSection({
  title,
  members,
  size,
  actions,
}: {
  title: string;
  members: CrewMember[];
  size: number;
  actions?: ReactNode;
}) {
  const words = useUiWords();
  const open = Math.max(0, size - members.length);
  const confirmed = members.filter((m) => m.confirmed).length;
  return (
    <Section
      title={title}
      description={words.crewLine(confirmed, members.length + open, open)}
      actions={actions}
    >
      <Card>
        <ul className="flex flex-wrap gap-x-6 gap-y-3">
          {members.map((m, i) => (
            <li key={`${m.name}-${i}`}>
              <CrewFace member={m} />
            </li>
          ))}
          {Array.from({ length: open }, (_, i) => (
            <li key={`open-${i}`}>
              <OpenMark />
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}

// A Job's extras, a part of their own (a Section titled `title`, "Extras"):
// one a line in a card, read down at a glance; with none, no part at all
export function ExtrasSection({
  title,
  extras,
}: {
  title: string;
  extras: string[];
}) {
  if (extras.length === 0) return null;
  return (
    <Section title={title}>
      <Card>
        <ul className="-my-3 divide-y divide-border">
          {extras.map((x) => (
            <li key={x} className="py-3 text-fg">
              {x}
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}
