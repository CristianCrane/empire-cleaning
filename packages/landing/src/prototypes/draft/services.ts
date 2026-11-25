import type { Language } from "@empire-cleaning/models";
import { PaintRoller, type LucideIcon } from "lucide-react";
import { serviceWords, services, type ServiceKey } from "../../services.ts";
import { draft } from "./words.ts";

// what we clean, one list for the home page and the quote form (#505): the
// site's names and icons, the form's describing lines, and Painting, which
// has no page of its own yet. Recurring visits are the plans' band, and
// post-construction and disinfecting are said in the deep clean's line
const shown = ["standard", "deep", "move", "office"] as const;

export type DraftService = {
  key: ServiceKey | "painting";
  name: string;
  text: string;
  icon: LucideIcon;
};

export function draftServices(lang: Language): DraftService[] {
  const d = draft[lang];
  return [
    ...shown.map((key) => ({
      key,
      name: serviceWords[lang][key].name,
      text: d.services[key],
      icon: services.find((s) => s.key === key)!.icon,
    })),
    { key: "painting", ...d.painting, icon: PaintRoller },
  ];
}
