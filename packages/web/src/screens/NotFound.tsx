import { SearchX } from "lucide-react";
import { catalog } from "@empire-cleaning/models";
import { useLanguage } from "@empire-cleaning/ui";
import { MessagePage } from "./MessagePage.tsx";

const words = catalog({
  en: { title: "Page not found", text: "That page doesn't exist." },
  es: { title: "No se encontró la página", text: "Esa página no existe." },
});

// also what a record that isn't the person's shows: we don't say it exists
export function NotFound() {
  const w = words[useLanguage()];
  return (
    <MessagePage title={w.title} icon={SearchX}>
      <p className="text-fg-muted">{w.text}</p>
    </MessagePage>
  );
}
