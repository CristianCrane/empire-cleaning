import { useLoaderData } from "@tanstack/react-router";
import { catalog } from "@empire-cleaning/models";
import {
  AnswerCard,
  ButtonLink,
  DateTile,
  HomePage,
  IconTile,
  Notice,
  type HomeTile,
} from "@empire-cleaning/ui";
import { useSaid } from "../words.ts";
import { QuoteIcon } from "../icons.ts";
import { requestQuoteHref, whatsNext, type Hero } from "./whats-next.ts";

const words = catalog({
  en: { shortcuts: "Shortcuts" },
  es: { shortcuts: "Accesos directos" },
});

// The Client's Home, a Home (docs/ux.md, Screen types): what's owed first,
// or the one thing next, in a card; then what's waiting on them and what
// they can do from there, in tiles (see whats-next.ts)
export function PortalHome() {
  const data = useLoaderData({ from: "/portal/" });
  const { w, lang, REQUEST_A_QUOTE } = useSaid(words);
  const { news, hero, tiles } = whatsNext(data, lang);
  // the hero asking for a Quote makes the header's Button a repeat
  const heroAsks = hero.action?.href === requestQuoteHref;

  return (
    <HomePage
      greet={data.client.name}
      actions={[
        !heroAsks && {
          label: REQUEST_A_QUOTE,
          icon: QuoteIcon,
          href: requestQuoteHref,
        },
      ]}
      answer={<HeroCard hero={hero} />}
      notices={news.map((text) => (
        <Notice key={text}>{text}</Notice>
      ))}
      tilesLabel={w.shortcuts}
      tiles={tiles.map(({ href, ...tile }): HomeTile =>
        typeof href === "string"
          ? { ...tile, externalHref: href }
          : { ...tile, href },
      )}
    />
  );
}

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
