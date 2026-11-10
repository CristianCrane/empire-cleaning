import type { Language } from "@empire-cleaning/models";
import { LanguageContext } from "@empire-cleaning/ui/language";
import { ThemeToggle } from "@empire-cleaning/ui/theme";

// The theme toggle in the page's language (ADR-0025): an island gets no
// React context from the page around it, so it renders inside its own. From
// the design system's own entry points, so the island ships just the
// toggle, not the whole design system
export function ThemeToggleIn({ lang }: { lang: Language }) {
  return (
    <LanguageContext value={lang}>
      <ThemeToggle />
    </LanguageContext>
  );
}
