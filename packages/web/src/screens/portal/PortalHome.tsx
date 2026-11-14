import { useLoaderData } from "@tanstack/react-router";
import {
  AnswerCard,
  ButtonLink,
  DateTile,
  Heading,
  IconTile,
  Link,
  Notice,
  ShortcutTile,
  ShortcutTiles,
  useLanguage,
} from "@empire-cleaning/ui";
import { catalog } from "@empire-cleaning/models";
import { useSaid } from "../words.ts";
import { linkTo } from "../../links.ts";
import { QuoteIcon } from "../icons.ts";
import { requestQuoteHref, whatsNext, type Hero } from "./whats-next.ts";

const words = catalog({
  en: {
    hi: (name: string) => `Hi, ${name}`,
    allCleans: "All your cleans",
    shortcuts: "Shortcuts",
  },
  es: {
    hi: (name: string) => `Hola, ${name}`,
    allCleans: "Todas sus limpiezas",
    shortcuts: "Accesos directos",
  },
});

// The Client's Home answers what's next: what's waiting on them in Notices,
// then the one thing next in a card, then shortcuts to what they can do
// from there (see whats-next.ts)
export function PortalHome() {
  const data = useLoaderData({ from: "/portal/" });
  const lang = useLanguage();
  const { w, REQUEST_A_QUOTE } = useSaid(words);
  const { notices, news, hero, after, shortcuts } = whatsNext(data, lang);
  const [firstName] = data.client.name.split(" ");
  // the hero asking for a Quote makes the header's Button a repeat
  const heroAsks = hero.action?.href === requestQuoteHref;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Heading level={1}>{w.hi(firstName!)}</Heading>
        {!heroAsks && (
          <ButtonLink variant="secondary" href={requestQuoteHref}>
            <QuoteIcon aria-hidden size={18} />
            {REQUEST_A_QUOTE}
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
          <Link href={linkTo({ to: "/portal/cleans" })}>{w.allCleans}</Link>
        </p>
      )}

      <ShortcutTiles label={w.shortcuts}>
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
        hero.action &&
        typeof hero.action.href !== "string" && (
          <ButtonLink href={hero.action.href}>{hero.action.label}</ButtonLink>
        )
      }
    />
  );
}
