import { catalog } from "@empire-cleaning/models";

// the Office's own Services, made by its first migration with these keys
// (packages/server/drizzle/20261028173633_services)
export const officeServices = {
  standard: {
    key: "5e7a1c00-0000-4000-8000-000000000001",
    name: "Standard Clean",
  },
  deep: { key: "5e7a1c00-0000-4000-8000-000000000002", name: "Deep Clean" },
  move: {
    key: "5e7a1c00-0000-4000-8000-000000000003",
    name: "Move-in/out Clean",
  },
  commercial: {
    key: "5e7a1c00-0000-4000-8000-000000000004",
    name: "Commercial cleaning",
  },
};

// the Add-ons every home Service offers, so never listed as included
export const addOnsNote = catalog({
  en: "Inside the fridge, inside the oven, inside the cabinets and interior windows are extras: tick the ones you'd like when you request a quote.",
  es: "El interior del refrigerador, el interior del horno, el interior de los gabinetes y las ventanas por dentro son adicionales: marque los que quiera cuando pida una cotización.",
});
