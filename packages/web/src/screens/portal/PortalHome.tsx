import { useLoaderData } from "@tanstack/react-router";
import {
  ButtonLink,
  Card,
  DateTile,
  Heading,
  IconTile,
  Link,
  Notice,
  ShortcutTile,
  ShortcutTiles,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { QuoteIcon } from "../icons.ts";
import { whatsNext, type Hero } from "./whats-next.ts";

// The Client's Home answers what's next: what's waiting on them in Notices,
// then the one thing next in a card, then shortcuts to what they can do
// from there (see whats-next.ts)
export function PortalHome() {
  const data = useLoaderData({ from: "/portal/" });
  const { notices, news, hero, after, shortcuts } = whatsNext(data);
  const [firstName] = data.client.name.split(" ");
  // the hero asking for a Quote makes the header's Button a repeat
  const heroAsks = hero.action?.label === "Request a Quote";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Heading level={1}>Hi, {firstName}</Heading>
        {!heroAsks && (
          <ButtonLink
            variant="secondary"
            href={linkTo({ to: "/portal/request" })}
          >
            <QuoteIcon aria-hidden size={18} />
            Request a Quote
          </ButtonLink>
        )}
      </div>

      {notices.map((n) => (
        <Notice
          key={n.text}
          tone="warning"
          action={
            typeof n.href === "string" ? undefined : (
              <ButtonLink variant="text" href={n.href}>
                {n.action}
              </ButtonLink>
            )
          }
        >
          {n.text}
        </Notice>
      ))}
      {/* news after what needs doing */}
      {news.map((text) => (
        <Notice key={text}>{text}</Notice>
      ))}

      <HeroCard hero={hero} />

      {after && (
        <p className="text-fg-muted">
          {after} ·{" "}
          <Link href={linkTo({ to: "/portal/cleans" })}>All your cleans</Link>
        </p>
      )}

      <ShortcutTiles label="Shortcuts">
        {shortcuts.map((s) =>
          typeof s.href === "string" ? (
            <ShortcutTile
              key={s.label}
              icon={s.icon}
              label={s.label}
              hint={s.hint}
              externalHref={s.href}
            />
          ) : (
            <ShortcutTile
              key={s.label}
              icon={s.icon}
              label={s.label}
              hint={s.hint}
              href={s.href}
            />
          ),
        )}
      </ShortcutTiles>
    </div>
  );
}

// the one answer, read left to right: when (or what it's about), what it
// is, and its one Button, the page's primary
function HeroCard({ hero }: { hero: Hero }) {
  return (
    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {hero.startsAt ? (
          <DateTile date={hero.startsAt} />
        ) : (
          <IconTile icon={hero.icon} tone={hero.tone} size="lg" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Heading level={2} size={4} className="text-fg-muted">
            {hero.label}
          </Heading>
          <p className="text-2xl font-semibold text-fg sm:text-3xl">
            {hero.headline}
          </p>
          {hero.lines.map((line) => (
            <p key={line} className="text-fg-muted">
              {line}
            </p>
          ))}
        </div>
        {hero.action && typeof hero.action.href !== "string" && (
          <ButtonLink
            className="shrink-0 self-start sm:self-center"
            href={hero.action.href}
          >
            {hero.action.label}
          </ButtonLink>
        )}
      </div>
    </Card>
  );
}
