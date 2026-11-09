import { catalog } from "@empire-cleaning/models";
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

// what we clean, on the page and in its search data, each by a key the
// service pages and the areas' most-asked lists name it by
export const services = [
  { key: "deep", icon: House },
  { key: "standard", icon: Sparkles },
  { key: "recurring", icon: Repeat },
  { key: "move", icon: Truck },
  { key: "post-construction", icon: HardHat },
  { key: "office", icon: Building2 },
  { key: "disinfecting", icon: SprayCan },
  { key: "custom", icon: SlidersHorizontal },
] as const;

export type ServiceKey = (typeof services)[number]["key"];

type ServiceWords = Record<ServiceKey, { name: string; text: string }>;

// each one's name and words; the owner edits them here. The Spanish is a
// draft the owner checks (#206)
export const serviceWords = catalog<ServiceWords>({
  en: {
    deep: {
      name: "Residential deep cleaning",
      text: "A top-to-bottom clean of your home, inside cabinets, behind appliances and everywhere in between.",
    },
    standard: {
      name: "Standard cleaning",
      text: "The regular upkeep that keeps a clean home feeling that way.",
    },
    recurring: {
      name: "Recurring service",
      text: "Weekly, bi-weekly or monthly visits on a schedule that suits you.",
    },
    move: {
      name: "Move-in and move-out",
      text: "An empty home made spotless, ready for keys to change hands.",
    },
    "post-construction": {
      name: "Post-construction",
      text: "Dust, debris and residue cleared after renovation or building work.",
    },
    office: {
      name: "Office cleaning",
      text: "Workspaces, kitchens and restrooms kept clean for your team and visitors.",
    },
    disinfecting: {
      name: "Disinfecting",
      text: "Thorough disinfection of high-touch surfaces and shared spaces.",
    },
    custom: {
      name: "Custom cleaning",
      text: "Something else in mind? Tell us what you need and we'll quote it.",
    },
  },
  es: {
    deep: {
      name: "Limpieza profunda de casas",
      text: "Una limpieza de su casa de arriba abajo, dentro de los gabinetes, detrás de los electrodomésticos y en todo lo demás.",
    },
    standard: {
      name: "Limpieza estándar",
      text: "El mantenimiento regular que hace que una casa limpia se siga sintiendo así.",
    },
    recurring: {
      name: "Servicio regular",
      text: "Visitas semanales, cada dos semanas o mensuales, en el horario que le convenga.",
    },
    move: {
      name: "Limpieza de mudanza",
      text: "Una casa vacía impecable, lista para entregar las llaves.",
    },
    "post-construction": {
      name: "Después de obras",
      text: "Polvo, escombros y residuos quitados después de una renovación o una obra.",
    },
    office: {
      name: "Limpieza de oficinas",
      text: "Espacios de trabajo, cocinas y baños limpios para su equipo y sus visitas.",
    },
    disinfecting: {
      name: "Desinfección",
      text: "Desinfección a fondo de las superficies de mucho contacto y los espacios compartidos.",
    },
    custom: {
      name: "Limpieza a su medida",
      text: "¿Tiene otra cosa en mente? Díganos lo que necesita y se lo cotizamos.",
    },
  },
});
