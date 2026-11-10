import { Building2, House } from "lucide-react";
import type { PropertyKind } from "@empire-cleaning/models";

// the one icon for a Quote, wherever a Quote shows: nav, New Quote, rows
export { ClipboardPenLine as QuoteIcon } from "lucide-react";

// the one icon for a Job, wherever Jobs show: nav, rows
export { BrushCleaning as JobIcon } from "lucide-react";

// the one icon for a Property, by its kind, wherever one shows: a house for
// a home, a building for business premises
export const homeIcon = (kind: PropertyKind) =>
  kind === "commercial" ? Building2 : House;
