import { desc, eq, sql } from "drizzle-orm";
import type {
  AddOnChoice,
  PriceList,
  PriceListInput,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { RequestBodyError } from "../../middleware/errors.ts";
import { z } from "zod";
import { staff } from "../staff/staff.schema.ts";
import {
  priceListAddOns,
  priceLists,
  type PriceListAddOnRow,
  type PriceListRow,
} from "./price-list.schema.ts";

// The starting figures, until Office Staff save their own. They are
// placeholders (the real ones are the business's to supply) and the Price List
// screen says so. Tax is the NYC combined rate for all three, pending the
// accountant (the spec: all rates start equal).
const placeholders: PriceListInput = {
  hourlyRateCents: 5500,
  minimumChargeCents: 10000,
  baseHours: 1,
  bedroomHours: 0.5,
  bathroomHours: 0.75,
  extraStoreyHours: 0.5,
  petHours: 0.5,
  conditionLight: 0.85,
  conditionModerate: 1,
  conditionHeavy: 1.4,
  deepCleanMultiplier: 1.6,
  depositPercent: 25,
  planDiscountPercent: 10,
  quoteValidityDays: 14,
  defaultCrewSize: 2,
  taxOneOffPercent: 8.875,
  taxServicePlanPercent: 8.875,
  taxFeePercent: 8.875,
  addOns: [
    { name: "Inside the oven", hours: 0.5, taxExempt: false, active: true },
    { name: "Inside the fridge", hours: 0.5, taxExempt: false, active: true },
    { name: "Inside the cabinets", hours: 1, taxExempt: false, active: true },
    { name: "Interior windows", hours: 1, taxExempt: false, active: true },
  ],
};

type Author = { name: string | null };

const toPriceList = (
  row: PriceListRow,
  addOns: PriceListAddOnRow[],
  author: Author,
): PriceList => ({
  id: row.id,
  version: row.version,
  placeholder: row.placeholder,
  createdAt: row.createdAt.toISOString(),
  createdByName: author.name,
  hourlyRateCents: row.hourlyRateCents,
  minimumChargeCents: row.minimumChargeCents,
  baseHours: row.baseHours,
  bedroomHours: row.bedroomHours,
  bathroomHours: row.bathroomHours,
  extraStoreyHours: row.extraStoreyHours,
  petHours: row.petHours,
  conditionLight: row.conditionLight,
  conditionModerate: row.conditionModerate,
  conditionHeavy: row.conditionHeavy,
  deepCleanMultiplier: row.deepCleanMultiplier,
  depositPercent: row.depositPercent,
  planDiscountPercent: row.planDiscountPercent,
  quoteValidityDays: row.quoteValidityDays,
  defaultCrewSize: row.defaultCrewSize,
  taxOneOffPercent: row.taxOneOffPercent,
  taxServicePlanPercent: row.taxServicePlanPercent,
  taxFeePercent: row.taxFeePercent,
  addOns: [...addOns]
    .sort((a, b) => a.position - b.position)
    .map((a) => ({
      key: a.key,
      name: a.name,
      hours: a.hours,
      taxExempt: a.taxExempt,
      active: a.active,
    })),
});

const latest = async () => {
  // the author is named by their Staff record: an Account has no name of its
  // own until it is connected to one (ADR-0006)
  const [row] = await db
    .select({ list: priceLists, authorName: staff.name })
    .from(priceLists)
    .leftJoin(staff, eq(staff.accountId, priceLists.createdBy))
    .orderBy(desc(priceLists.version))
    .limit(1);
  if (!row) return undefined;

  const addOns = await db
    .select()
    .from(priceListAddOns)
    .where(eq(priceListAddOns.priceListId, row.list.id));
  return toPriceList(row.list, addOns, { name: row.authorName });
};

// inserts a version and its Add-ons; `addOns` already have their keys
const insertVersion = async (
  input: Omit<PriceListInput, "addOns"> & {
    addOns: (PriceListInput["addOns"][number] & { key: string })[];
  },
  options: { placeholder: boolean; createdBy: string | null },
) => {
  const { addOns, ...figures } = input;
  await db.transaction(async (tx) => {
    const [list] = await tx
      .insert(priceLists)
      .values({ ...figures, ...options })
      .returning();
    if (addOns.length > 0) {
      await tx.insert(priceListAddOns).values(
        addOns.map((addOn, position) => ({
          ...addOn,
          position,
          priceListId: list!.id,
        })),
      );
    }
  });
};

// the Price List in force: the latest version. The very first read creates
// version 1 from the placeholders, so a fresh install always has one.
export const currentPriceList = async (): Promise<PriceList> => {
  const existing = await latest();
  if (existing) return existing;

  // two first reads at once mustn't both create version 1
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4004)`);
    const [already] = await tx
      .select({ id: priceLists.id })
      .from(priceLists)
      .limit(1);
    if (already) return;

    const { addOns, ...figures } = placeholders;
    const [list] = await tx
      .insert(priceLists)
      .values({ ...figures, placeholder: true, createdBy: null })
      .returning();
    await tx.insert(priceListAddOns).values(
      addOns.map((addOn, position) => ({
        ...addOn,
        key: crypto.randomUUID(),
        position,
        priceListId: list!.id,
      })),
    );
  });
  return (await latest())!;
};

// Saves a new version. Add-ons are never deleted: one left out of the
// submission is kept, retired, so requests that chose it still mean something.
export const savePriceList = async (
  input: PriceListInput,
  createdBy: string,
): Promise<PriceList> => {
  const current = await currentPriceList();
  const known = new Map(current.addOns.map((a) => [a.key, a]));

  const unknown = input.addOns.findIndex((a) => a.key && !known.has(a.key));
  if (unknown !== -1) {
    throw new RequestBodyError(
      new z.ZodError([
        {
          code: "custom",
          path: ["addOns", unknown, "name"],
          message: "That Add-on isn't on the Price List any more; reload it",
          input: input.addOns[unknown],
        },
      ]),
    );
  }

  const submitted = new Set(input.addOns.map((a) => a.key));
  const kept = input.addOns.map((a) => ({
    ...a,
    key: a.key ?? crypto.randomUUID(),
  }));
  const left = current.addOns
    .filter((a) => !submitted.has(a.key))
    .map((a) => ({ ...a, active: false }));

  await insertVersion(
    { ...input, addOns: [...kept, ...left] },
    { placeholder: false, createdBy },
  );
  return currentPriceList();
};

// the Add-ons a Client can pick now: names only, never prices (those are on
// the Quote). Open to everyone, as the landing page's form needs it.
export const choosableAddOns = async (): Promise<AddOnChoice[]> => {
  const list = await currentPriceList();
  return list.addOns
    .filter((a) => a.active)
    .map(({ key, name }) => ({ key, name }));
};
