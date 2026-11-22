import { SearchX } from "lucide-react";
import { catalog } from "@empire-cleaning/models";
import { MessagePage, useLanguage } from "@empire-cleaning/ui";
import { linkTo } from "../links.ts";

const words = catalog({
  // the line says what the title doesn't: how a page goes missing
  en: {
    title: "Page not found",
    text: "The link may be old, or the address mistyped.",
  },
  es: {
    title: "No se encontró la página",
    text: "Puede que el enlace sea antiguo o que la dirección esté mal escrita.",
  },
});

// also what a record that isn't the person's shows: we don't say it exists
export function NotFound() {
  const w = words[useLanguage()];
  return (
    <MessagePage title={w.title} icon={SearchX} home={linkTo({ to: "/" })}>
      <p className="text-fg-muted">{w.text}</p>
    </MessagePage>
  );
}
