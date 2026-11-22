import { useLoaderData } from "@tanstack/react-router";
import { catalog } from "@empire-cleaning/models";
import { HomePage, Notice } from "@empire-cleaning/ui";
import { useSaid } from "../words.ts";
import { QuoteIcon } from "../icons.ts";
import { HeroCard, whyAlert } from "./HeroCard.tsx";
import { requestQuoteHref, whatsNext } from "./whats-next.ts";

const words = catalog({
  en: { shortcuts: "Shortcuts" },
  es: { shortcuts: "Accesos directos" },
});

// The Client's Home, a Home (docs/ux.md, Screen types): what waits on them
// first, or the one thing next, in a card, why above it when it needs a
// reason; then what else waits on them and what they can do from there,
// in tiles (see whats-next.ts)
export function PortalHome() {
  const data = useLoaderData({ from: "/portal/" });
  const { w, lang, REQUEST_A_QUOTE } = useSaid(words);
  const { news, hero, why, asks, tiles } = whatsNext(data, lang);
  // Request a quote stands aside while the card asks something else of
  // them, and is a repeat when it's the card's own Button
  const aside = asks || hero.action?.href === requestQuoteHref;

  return (
    <HomePage
      greet={data.client.name}
      actions={[
        !aside && {
          label: REQUEST_A_QUOTE,
          icon: QuoteIcon,
          href: requestQuoteHref,
        },
      ]}
      alerts={[whyAlert(why)]}
      answer={<HeroCard hero={hero} />}
      notices={news.map((text) => (
        <Notice key={text}>{text}</Notice>
      ))}
      tilesLabel={w.shortcuts}
      tiles={tiles}
    />
  );
}
