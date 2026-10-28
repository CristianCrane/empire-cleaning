import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  CleanType,
  PriceList,
  PropertyKind,
  Service,
  ServiceInput,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { NotFoundError, RequestBodyError } from "../../middleware/errors.ts";
import { z } from "zod";
import { currentPriceList } from "../price-list/price-list.ts";
import { staff } from "../staff/staff.schema.ts";
import { services, type ServiceRow } from "./services.schema.ts";

// The Services every install starts with, keyed the same everywhere, so the
// migration and a fresh database agree on them. Until Quotes are for a
// Service the Client asks for (#122), a Quote's Clean Type picks one of
// these: Standard and Deep for a home, and the commercial pair for business
// premises.
export const SEEDED = {
  standard: "5e7a1c00-0000-4000-8000-000000000001",
  deep: "5e7a1c00-0000-4000-8000-000000000002",
  commercial: "5e7a1c00-0000-4000-8000-000000000003",
  commercialDeep: "5e7a1c00-0000-4000-8000-000000000004",
} as const;

// the starting figures, as the Price List's placeholders were before
// Services had their own (the real ones are the business's to supply)
const TAX = 8.875;
const placeholders: (ServiceInput & { key: string })[] = [
  {
    key: SEEDED.standard,
    name: "Standard Clean",
    description: "The regular upkeep that keeps a clean home feeling that way.",
    offeredFor: "homes",
    method: "rooms",
    multiplier: 1,
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
    offeredFor: "homes",
    method: "rooms",
    multiplier: 1.6,
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
    key: SEEDED.commercial,
    name: "Commercial cleaning",
    description:
      "Workspaces, kitchens and restrooms kept clean for your team and visitors.",
    offeredFor: "businesses",
    method: "area",
    multiplier: null,
    hoursPerThousandSqFt: 0.5,
    hourlyRateCents: 5500,
    minimumChargeCents: 10000,
    taxOneOffPercent: TAX,
    taxPlanPercent: TAX,
    conditionApplies: true,
    canRecur: true,
    needsSiteVisit: true,
    firstVisitServiceKey: SEEDED.commercialDeep,
    active: true,
  },
  {
    key: SEEDED.commercialDeep,
    name: "Commercial deep clean",
    description: "A thorough clean of business premises, top to bottom.",
    offeredFor: "businesses",
    method: "area",
    multiplier: null,
    hoursPerThousandSqFt: 0.8,
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
];

const toService = (row: ServiceRow, authorName: string | null): Service => ({
  key: row.key,
  id: row.id,
  version: row.version,
  createdAt: row.createdAt.toISOString(),
  createdByName: authorName,
  name: row.name,
  description: row.description,
  offeredFor: row.offeredFor,
  method: row.method,
  multiplier: row.multiplier,
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
      .values(placeholders.map((s, position) => ({ ...s, position })));
  });
  return latest();
};

export const findService = async (key: string): Promise<Service> => {
  const service = (await currentServices()).find((s) => s.key === key);
  if (!service) throw new NotFoundError("Service not found");
  return service;
};

// The Service a Quote's Clean Type prices, until Quotes are for a Service
// of their own (#122). A retired one still prices.
export const serviceFor = (
  all: Service[],
  kind: PropertyKind,
  cleanType: CleanType,
): Service => {
  const key =
    kind === "commercial"
      ? cleanType === "deep"
        ? SEEDED.commercialDeep
        : SEEDED.commercial
      : SEEDED[cleanType];
  const service = all.find((s) => s.key === key);
  if (!service) throw new Error(`no Service ${key}`);
  return service;
};

// the Service versions some rows recorded, by id
export const serviceVersions = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, Service>();
  const rows = await db
    .select()
    .from(services)
    .where(inArray(services.id, ids));
  return new Map(rows.map((row) => [row.id, toService(row, null)]));
};

const fieldError = (path: (string | number)[], message: string) =>
  new RequestBodyError(
    new z.ZodError([{ code: "custom", path, message, input: undefined }]),
  );

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
      "Recommend a different Service, or none",
    );
  }
  if (!all.some((s) => s.key === recommended)) {
    throw fieldError(
      ["firstVisitServiceKey"],
      "Choose from the Services listed",
    );
  }
};

const checkName = (all: Service[], key: string | null, input: ServiceInput) => {
  const name = input.name.toLowerCase();
  if (
    input.active &&
    all.some((s) => s.key !== key && s.active && s.name.toLowerCase() === name)
  ) {
    throw fieldError(["name"], "Another Service already has this name");
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
  await db
    .insert(services)
    .values({ ...input, key, position: (last ?? -1) + 1, createdBy });
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
  await db
    .insert(services)
    .values({ ...input, key, position: first!.position, createdBy });
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
