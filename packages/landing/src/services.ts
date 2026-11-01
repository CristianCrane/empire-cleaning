import {
  Building2,
  HardHat,
  House,
  Repeat,
  SlidersHorizontal,
  Sparkles,
  SprayCan,
  Truck,
} from "lucide-react";

// what we clean, on the page and in its search data; the owner edits them here
export const services = [
  {
    icon: House,
    name: "Residential deep cleaning",
    text: "A top-to-bottom clean of your home, inside cabinets, behind appliances and everywhere in between.",
  },
  {
    icon: Sparkles,
    name: "Standard cleaning",
    text: "The regular upkeep that keeps a clean home feeling that way.",
  },
  {
    icon: Repeat,
    name: "Recurring service",
    text: "Weekly, bi-weekly or monthly visits on a schedule that suits you.",
  },
  {
    icon: Truck,
    name: "Move-in and move-out",
    text: "An empty home made spotless, ready for keys to change hands.",
  },
  {
    icon: HardHat,
    name: "Post-construction",
    text: "Dust, debris and residue cleared after renovation or building work.",
  },
  {
    icon: Building2,
    name: "Office cleaning",
    text: "Workspaces, kitchens and restrooms kept clean for your team and visitors.",
  },
  {
    icon: SprayCan,
    name: "Disinfecting",
    text: "Thorough disinfection of high-touch surfaces and shared spaces.",
  },
  {
    icon: SlidersHorizontal,
    name: "Custom cleaning",
    text: "Something else in mind? Tell us what you need and we'll quote it.",
  },
] as const;

export type ServiceName = (typeof services)[number]["name"];
