import { Check, UserRound } from "lucide-react";
import { Avatar } from "./Avatar.tsx";
import { Card } from "./Card.tsx";
import { useUiWords } from "./language.ts";
import { Section } from "./Section.tsx";

// someone on a Job's crew: their name as this reader calls them ("You",
// "Dee"), their picture if any, and whether they've confirmed
export type CrewMember = {
  name: string;
  confirmed: boolean;
  picture?: string | null;
};

// A Cleaner Needed on a crew: a ghost of a face, its person faint and thin in
// a dashed ring with no fill, so it reads as someone still needed, not an
// empty circle (the `ui` skill, "A picture, not a paragraph"); the face's
// size, so a row of them lines up
export function NeededMark() {
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
        {words.needed}
        <span className="sr-only">, {words.cleanerNeeded}</span>
      </span>
    </span>
  );
}

// One person on a crew: every face the same, a green tick on it once
// they've confirmed and nothing till then: the tick says it once, so no
// word beside it but for a screen reader
// On a Job that's over (`over`), who was there: no tick, and nothing read
// out of whether they'd confirmed
export function CrewFace({
  member,
  over = false,
}: {
  member: CrewMember;
  over?: boolean;
}) {
  const words = useUiWords();
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative">
        <Avatar src={member.picture} />
        {member.confirmed && !over && (
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
        {!over && (
          <span className="sr-only">
            , {member.confirmed ? words.confirmed : words.notConfirmedYet}
          </span>
        )}
      </span>
    </span>
  );
}

// A Job's crew, a part of its own (a Section titled `title`, "Crew"): a
// line saying where it stands ("1 of 2 confirmed, 1 needed"), and under it
// `line`, what this reader needs to know too (the Office's: when free
// cleaners can take it), a line of its own so it doesn't read as the
// count's; then a face for each member and a ghost for each Cleaner Needed,
// in a card. `size` is how many the Job takes. The line says nothing of a
// crew all confirmed: the ticks say it. On a Job that's over (`over`), only
// who was there, those who'd confirmed: no line, no ghosts, no ticks; none,
// no part at all
export function CrewSection({
  title,
  members,
  size,
  line,
  over = false,
}: {
  title: string;
  members: CrewMember[];
  size: number;
  line?: string;
  over?: boolean;
}) {
  const words = useUiWords();
  const shown = over ? members.filter((m) => m.confirmed) : members;
  if (over && shown.length === 0) return null;
  const needed = over ? 0 : Math.max(0, size - members.length);
  const confirmed = members.filter((m) => m.confirmed).length;
  const stands =
    needed === 0 && confirmed === members.length
      ? null
      : words.crewLine(confirmed, members.length + needed, needed);
  const description = !over && (stands || line) && (
    <>
      {stands && <span className="block">{stands}</span>}
      {line && <span className="block">{line}</span>}
    </>
  );
  return (
    <Section title={title} description={description || undefined}>
      <Card>
        <ul className="flex flex-wrap gap-x-6 gap-y-3">
          {shown.map((m, i) => (
            <li key={`${m.name}-${i}`}>
              <CrewFace member={m} over={over} />
            </li>
          ))}
          {Array.from({ length: needed }, (_, i) => (
            <li key={`needed-${i}`}>
              <NeededMark />
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
