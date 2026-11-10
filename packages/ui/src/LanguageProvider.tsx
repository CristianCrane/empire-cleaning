import type { ReactNode } from "react";
import { I18nProvider } from "react-aria-components";
import { type Language, locales } from "@empire-cleaning/models";
import { LanguageContext } from "./language.ts";

// gives everything inside it its language: the design system's words
// (useLanguage), and react-aria's own (a date field's parts, a list's
// announcements) through its locale
export function LanguageProvider({
  lang,
  children,
}: {
  lang: Language;
  children: ReactNode;
}) {
  return (
    <LanguageContext value={lang}>
      <I18nProvider locale={locales[lang]}>{children}</I18nProvider>
    </LanguageContext>
  );
}
