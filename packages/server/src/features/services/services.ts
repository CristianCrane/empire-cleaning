import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  PriceList,
  PropertyKind,
  Service,
  ServiceChoice,
  ServiceInput,
  ServiceIcon,
  ServiceOffer,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { fieldError, NotFoundError } from "../../middleware/errors.ts";
import type { Clean } from "../../services/email/blocks.ts";
import { currentPriceList } from "../price-list/price-list.ts";
import { addressOf } from "../properties/property-view.ts";
import { staff } from "../staff/staff.schema.ts";
import { SEEDED } from "./seeded.ts";
import { services, type ServiceRow } from "./services.schema.ts";

export { SEEDED } from "./seeded.ts";

// the starting figures, as the Price List's placeholders were before
// Services had their own (the real ones are the business's to supply). The
// Spanish is a draft the owner checks (#206); a migration gave it to the
// Services already saved (20261110082341)
const TAX = 8.875;
const placeholders: (ServiceInput & { key: string })[] = [
  {
    key: SEEDED.standard,
    name: "Standard Clean",
    description: "The regular upkeep that keeps a clean home feeling that way.",
    nameEs: "Limpieza estándar",
    descriptionEs:
      "El mantenimiento regular que hace que una casa limpia se siga sintiendo así.",
    offeredFor: "homes",
    method: "rooms",
    roomHours: {
      baseHours: 1,
      bedroomHours: 0.5,
      bathroomHours: 0.75,
      extraStoreyHours: 0.5,
      petHours: 0.5,
    },
    hoursPerThousandSqFt: null,
    hourlyRateCents: 5500,
    minimumChargeCents: 10000,
    taxOneOffPercent: TAX,
    taxPlanPercent: TAX,
    conditionApplies: true,
    canRecur: true,
    needsSiteVisit: false,
    firstVisitServiceKey: SEEDED.deep,
    active: true,
  },
  {
    key: SEEDED.deep,
    name: "Deep Clean",
    description:
      "A top-to-bottom clean, inside cabinets, behind appliances and everywhere in between.",
    nameEs: "Limpieza profunda",
    descriptionEs:
      "Una limpieza de arriba abajo, dentro de los gabinetes, detrás de los electrodomésticos y en todo lo demás.",
    offeredFor: "homes",
    method: "rooms",
    roomHours: {
      baseHours: 1.6,
      bedroomHours: 0.8,
      bathroomHours: 1.2,
      extraStoreyHours: 0.8,
      petHours: 0.8,
    },
    hoursPerThousandSqFt: null,
    hourlyRateCents: 5500,
    minimumChargeCents: 10000,
    taxOneOffPercent: TAX,
    taxPlanPercent: TAX,
    conditionApplies: true,
    canRecur: true,
    needsSiteVisit: false,
    firstVisitServiceKey: null,
    active: true,
  },
  {
    key: SEEDED.moveInOut,
    name: "Move-in/out Clean",
    description: "An empty home made spotless, ready for keys to change hands.",
    nameEs: "Limpieza de mudanza",
    descriptionEs: "Una casa vacía impecable, lista para entregar las llaves.",
    offeredFor: "homes",
    method: "rooms",
    roomHours: {
      baseHours: 1.6,
      bedroomHours: 0.8,
      bathroomHours: 1.2,
      extraStoreyHours: 0.8,
      petHours: 0.8,
    },
    hoursPerThousandSqFt: null,
    hourlyRateCents: 5500,
    minimumChargeCents: 10000,
    taxOneOffPercent: TAX,
    taxPlanPercent: null,
    conditionApplies: true,
    canRecur: false,
    needsSiteVisit: false,
    firstVisitServiceKey: null,
    active: true,
  },
  {
    key: SEEDED.commercial,
    name: "Commercial cleaning",
    description:
      "Workspaces, kitchens and restrooms kept clean for your team and visitors.",
    nameEs: "Limpieza comercial",
    descriptionEs:
      "Espacios de trabajo, cocinas y baños limpios para su equipo y sus visitas.",
    offeredFor: "businesses",
    method: "area",
    roomHours: null,
    hoursPerThousandSqFt: 0.5,
    hourlyRateCents: 5500,
    minimumChargeCents: 10000,
    taxOneOffPercent: TAX,
    taxPlanPercent: TAX,
    conditionApplies: true,
    canRecur: true,
    needsSiteVisit: true,
    firstVisitServiceKey: null,
    active: true,
  },
  {
    key: SEEDED.painting,
    name: "Painting",
    description:
      "Walls, ceilings and trim painted cleanly, with the room left as we found it.",
    nameEs: "Pintura",
    descriptionEs:
      "Paredes, techos y molduras pintados con cuidado, y el cuarto queda como lo encontramos.",
    offeredFor: "both",
    method: "area",
    roomHours: null,
    hoursPerThousandSqFt: 8,
    hourlyRateCents: 6000,
    minimumChargeCents: 30000,
    taxOneOffPercent: TAX,
    taxPlanPercent: null,
    conditionApplies: false,
    canRecur: false,
    needsSiteVisit: true,
    firstVisitServiceKey: null,
    active: true,
  },
];

// a Service as its row stores it: the room hours flat
const columnsOf = <T extends ServiceInput>({ roomHours, ...rest }: T) => ({
  ...rest,
  ...roomHours,
});

const toService = (row: ServiceRow, authorName: string | null): Service => ({
  key: row.key,
  id: row.id,
  version: row.version,
  createdAt: row.createdAt.toISOString(),
  createdByName: authorName,
  name: row.name,
  description: row.description,
  nameEs: row.nameEs,
  descriptionEs: row.descriptionEs,
  offeredFor: row.offeredFor,
  method: row.method,
  roomHours:
    row.method === "rooms"
      ? {
          baseHours: row.baseHours!,
          bedroomHours: row.bedroomHours!,
          bathroomHours: row.bathroomHours!,
          extraStoreyHours: row.extraStoreyHours!,
          petHours: row.petHours!,
        }
      : null,
  hoursPerThousandSqFt: row.hoursPerThousandSqFt,
  hourlyRateCents: row.hourlyRateCents,
  minimumChargeCents: row.minimumChargeCents,
  taxOneOffPercent: row.taxOneOffPercent,
  taxPlanPercent: row.taxPlanPercent,
  conditionApplies: row.conditionApplies,
  canRecur: row.canRecur,
  needsSiteVisit: row.needsSiteVisit,
  firstVisitServiceKey: row.firstVisitServiceKey,
  active: row.active,
});

// every Service's latest version, in the list's order; the author is named
// by their Staff record, as on the Price List
const latest = async () => {
  const rows = await db
    .selectDistinctOn([services.key], {
      service: services,
      authorName: staff.name,
    })
    .from(services)
    .leftJoin(staff, eq(staff.accountId, services.createdBy))
    .orderBy(services.key, desc(services.version));
  return rows
    .sort((a, b) => a.service.position - b.service.position)
    .map((r) => toService(r.service, r.authorName));
};

// what a choice of a Service that isn't on offer is told
export const NOT_A_SERVICE = "Pick a service from the list";

// Every Service as it is now, active and retired. The very first read
// creates the starting ones, so a fresh install always has them.
export const currentServices = async (): Promise<Service[]> => {
  const existing = await latest();
  if (existing.length > 0) return existing;

  // two first reads at once mustn't both create them
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4005)`);
    const [already] = await tx
      .select({ id: services.id })
      .from(services)
      .limit(1);
    if (already) return;
    await tx
      .insert(services)
      .values(
        placeholders.map((s, position) => ({ ...columnsOf(s), position })),
      );
  });
  return latest();
};

export const findService = async (key: string): Promise<Service> => {
  const service = (await currentServices()).find((s) => s.key === key);
  if (!service) throw new NotFoundError("Service not found");
  return service;
};

// a Service as it is now, by key: a retired one still prices what used it
export const serviceOf = (all: Service[], key: string): Service => {
  const service = all.find((s) => s.key === key);
  if (!service) throw new Error(`no Service ${key}`);
  return service;
};

export const choiceOf = ({ key, name, method }: Service): ServiceChoice => ({
  key,
  name,
  method,
});

// whether a Service is offered for a kind of Property
export const offeredAt = (service: Service, kind: PropertyKind) =>
  service.offeredFor === "both" ||
  service.offeredFor === (kind === "commercial" ? "businesses" : "homes");

// the Services a new Quote can be for at a kind of Property, in the list's
// order
export const onOfferAt = (all: Service[], kind: PropertyKind) =>
  all.filter((s) => s.active && offeredAt(s, kind));

// the seeded Services' pictures, matching the landing page's "What we
// clean"; any other Service is a custom one
const icons: Record<string, ServiceIcon> = {
  [SEEDED.standard]: "sparkles",
  [SEEDED.deep]: "house",
  [SEEDED.moveInOut]: "truck",
  [SEEDED.commercial]: "building",
  [SEEDED.painting]: "paint-roller",
};

// The Services a new Quote can be asked for, in the list's order, as the
// "Request a Quote" form offers them
export const servicesOnOffer = async (): Promise<ServiceOffer[]> =>
  (await currentServices())
    .filter((s) => s.active)
    .map((s) => ({
      key: s.key,
      name: s.name,
      description: s.description,
      offeredFor: s.offeredFor,
      method: s.method,
      conditionApplies: s.conditionApplies,
      canRecur: s.canRecur,
      icon: icons[s.key] ?? "custom",
    }));

// The Services a one-off Quote for `service` offers: the one it recommends
// in its place for a first visit, while that's on offer here and the
// Property has no Completed Job, then its own
export const oneOffServices = (
  all: Service[],
  service: Service,
  kind: PropertyKind,
  firstVisit: boolean,
): Service[] => {
  const recommended = firstVisit
    ? all.find((s) => s.key === service.firstVisitServiceKey)
    : undefined;
  return recommended?.active && offeredAt(recommended, kind)
    ? [recommended, service]
    : [service];
};

// Service versions never change, so once read they're kept
const versions = new Map<string, Service>();

// the Service versions some rows recorded, by id
export const serviceVersions = async (
  ids: string[],
  tx: Tx | typeof db = db,
) => {
  const missing = [...new Set(ids)].filter((id) => !versions.has(id));
  if (missing.length > 0) {
    const rows = await tx
      .select()
      .from(services)
      .where(inArray(services.id, missing));
    for (const row of rows) versions.set(row.id, toService(row, null));
  }
  return new Map(ids.map((id) => [id, versions.get(id)!]));
};

// the name a Job's Service had when it was booked
export const serviceNameOf = async (
  serviceId: string,
  tx: Tx | typeof db = db,
) => (await serviceVersions([serviceId], tx)).get(serviceId)!.name;

// a Job, as an email's details give it
export const cleanOf = async (
  job: { serviceId: string; startsAt: Date },
  property: Parameters<typeof addressOf>[0],
): Promise<Clean> => ({
  service: await serviceNameOf(job.serviceId),
  address: addressOf(property),
  startsAt: job.startsAt,
});

// a first-visit recommendation must be another Service there is
const checkFirstVisit = (
  all: Service[],
  key: string | null,
  input: ServiceInput,
) => {
  const recommended = input.firstVisitServiceKey;
  if (recommended === null) return;
  if (recommended === key) {
    throw fieldError(
      ["firstVisitServiceKey"],
      "Recommend a different service, or none",
    );
  }
  if (!all.some((s) => s.key === recommended)) {
    throw fieldError(["firstVisitServiceKey"], NOT_A_SERVICE);
  }
};

const checkName = (all: Service[], key: string | null, input: ServiceInput) => {
  const name = input.name.toLowerCase();
  if (
    input.active &&
    all.some((s) => s.key !== key && s.active && s.name.toLowerCase() === name)
  ) {
    throw fieldError(["name"], "Another service already has this name");
  }
};

// adds a Service, at the end of the list
export const createService = async (
  input: ServiceInput,
  createdBy: string,
): Promise<Service> => {
  const all = await currentServices();
  checkName(all, null, input);
  checkFirstVisit(all, null, input);
  const key = crypto.randomUUID();
  const [{ last }] = (await db
    .select({ last: sql<number>`max(${services.position})` })
    .from(services)) as [{ last: number | null }];
  await db.insert(services).values({
    ...columnsOf(input),
    key,
    position: (last ?? -1) + 1,
    createdBy,
  });
  return findService(key);
};

// saves a new version of a Service: changes only affect prices worked out
// from now. Retiring is saving it inactive.
export const saveService = async (
  key: string,
  input: ServiceInput,
  createdBy: string,
): Promise<Service> => {
  const all = await currentServices();
  const current = all.find((s) => s.key === key);
  if (!current) throw new NotFoundError("Service not found");
  checkName(all, key, input);
  checkFirstVisit(all, key, input);
  const [first] = await db
    .select({ position: services.position })
    .from(services)
    .where(eq(services.key, key))
    .orderBy(asc(services.version))
    .limit(1);
  await db.insert(services).values({
    ...columnsOf(input),
    key,
    position: first!.position,
    createdBy,
  });
  return findService(key);
};

// Everything a Suggested Price is worked out from: the Price List in force
// and every Service as it is now
export type Pricing = PriceList & { services: Service[] };

export const currentPricing = async (): Promise<Pricing> => {
  const [list, all] = await Promise.all([
    currentPriceList(),
    currentServices(),
  ]);
  return { ...list, services: all };
};
