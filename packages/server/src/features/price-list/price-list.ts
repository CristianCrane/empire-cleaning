import { desc, eq, sql } from "drizzle-orm";
import type {
  AddOnChoice,
  PremisesTypeChoice,
  PriceList,
  PriceListInput,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { RequestBodyError } from "../../middleware/errors.ts";
import { z } from "zod";
import { currentServices, findService } from "../services/services.ts";
import { SEEDED, SEEDED_FOR_HOMES } from "../services/seeded.ts";
import { staff } from "../staff/staff.schema.ts";
import {
  priceListAddOns,
  priceListPremisesTypes,
  priceLists,
  type PriceListAddOnRow,
  type PriceListPremisesTypeRow,
  type PriceListRow,
} from "./price-list.schema.ts";

// The starting figures, until Office Staff save their own. They are
// placeholders (the real ones are the business's to supply) and the Price List
// screen says so. The fee tax is the NYC combined rate, pending the
// accountant. Premises Types are against an office (#72). Add-ons go with
// the seeded Services for homes, and windows with every one.
const placeholders: PriceListInput = {
  conditionLight: 0.85,
  conditionModerate: 1,
  conditionHeavy: 1.4,
  depositPercent: 25,
  planDiscountPercent: 10,
  quoteValidityDays: 14,
  defaultCrewSize: 2,
  taxFeePercent: 8.875,
  addOns: [
    {
      name: "Inside the oven",
      hours: 0.5,
      taxExempt: false,
      serviceKeys: SEEDED_FOR_HOMES,
      active: true,
    },
    {
      name: "Inside the fridge",
      hours: 0.5,
      taxExempt: false,
      serviceKeys: SEEDED_FOR_HOMES,
      active: true,
    },
    {
      name: "Inside the cabinets",
      hours: 1,
      taxExempt: false,
      serviceKeys: SEEDED_FOR_HOMES,
      active: true,
    },
    {
      name: "Interior windows",
      hours: 1,
      taxExempt: false,
      serviceKeys: [...SEEDED_FOR_HOMES, SEEDED.commercial],
      active: true,
    },
  ],
  premisesTypes: [
    { name: "Office", multiplier: 1, active: true },
    { name: "Retail", multiplier: 0.8, active: true },
    { name: "Medical", multiplier: 1.6, active: true },
    { name: "Other", multiplier: 1.2, active: true },
  ],
};

type Author = { name: string | null };

const toPriceList = (
  row: PriceListRow,
  addOns: PriceListAddOnRow[],
  premisesTypes: PriceListPremisesTypeRow[],
  author: Author,
): PriceList => ({
  id: row.id,
  version: row.version,
  placeholder: row.placeholder,
  createdAt: row.createdAt.toISOString(),
  createdByName: author.name,
  conditionLight: row.conditionLight,
  conditionModerate: row.conditionModerate,
  conditionHeavy: row.conditionHeavy,
  depositPercent: row.depositPercent,
  planDiscountPercent: row.planDiscountPercent,
  quoteValidityDays: row.quoteValidityDays,
  defaultCrewSize: row.defaultCrewSize,
  taxFeePercent: row.taxFeePercent,
  addOns: [...addOns]
    .sort((a, b) => a.position - b.position)
    .map((a) => ({
      key: a.key,
      name: a.name,
      hours: a.hours,
      taxExempt: a.taxExempt,
      serviceKeys: a.serviceKeys,
      active: a.active,
    })),
  premisesTypes: [...premisesTypes]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({
      key: p.key,
      name: p.name,
      multiplier: p.multiplier,
      active: p.active,
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

  const [addOns, premisesTypes] = await Promise.all([
    db
      .select()
      .from(priceListAddOns)
      .where(eq(priceListAddOns.priceListId, row.list.id)),
    db
      .select()
      .from(priceListPremisesTypes)
      .where(eq(priceListPremisesTypes.priceListId, row.list.id)),
  ]);
  return toPriceList(row.list, addOns, premisesTypes, {
    name: row.authorName,
  });
};

type Keyed<T> = T & { key: string };

// inserts a version with its Add-ons and Premises Types, which already have
// their keys
const insertVersion = async (
  tx: Tx,
  input: Omit<PriceListInput, "addOns" | "premisesTypes"> & {
    addOns: Keyed<PriceListInput["addOns"][number]>[];
    premisesTypes: Keyed<PriceListInput["premisesTypes"][number]>[];
  },
  options: { placeholder: boolean; createdBy: string | null },
) => {
  const { addOns, premisesTypes, ...figures } = input;
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
  if (premisesTypes.length > 0) {
    await tx.insert(priceListPremisesTypes).values(
      premisesTypes.map((premisesType, position) => ({
        ...premisesType,
        position,
        priceListId: list!.id,
      })),
    );
  }
};

const withKeys = <T extends { key?: string }>(items: T[]) =>
  items.map((item) => ({ ...item, key: item.key ?? crypto.randomUUID() }));

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

    await insertVersion(
      tx,
      {
        ...placeholders,
        addOns: withKeys(placeholders.addOns),
        premisesTypes: withKeys(placeholders.premisesTypes),
      },
      { placeholder: true, createdBy: null },
    );
  });
  return (await latest())!;
};

// The submitted items of one kind, with the current ones left out kept as
// retired: never deleted, so whatever chose or used them still means
// something. A key the current version doesn't have is refused.
const keepRetired = <T extends { key?: string; name: string; active: boolean }>(
  submitted: T[],
  current: (T & { key: string })[],
  field: "addOns" | "premisesTypes",
  gone: string,
) => {
  const known = new Set(current.map((item) => item.key));
  const unknown = submitted.findIndex(
    (item) => item.key && !known.has(item.key),
  );
  if (unknown !== -1) {
    throw new RequestBodyError(
      new z.ZodError([
        {
          code: "custom",
          path: [field, unknown, "name"],
          message: gone,
          input: submitted[unknown],
        },
      ]),
    );
  }
  const keys = new Set(submitted.map((item) => item.key));
  const left = current
    .filter((item) => !keys.has(item.key))
    .map((item) => ({ ...item, active: false }));
  return [...withKeys(submitted), ...left];
};

// an Add-on goes only with Services there are
const checkServiceKeys = async (input: PriceListInput) => {
  const known = new Set((await currentServices()).map((s) => s.key));
  for (const [i, addOn] of input.addOns.entries()) {
    if (addOn.serviceKeys.some((key) => !known.has(key))) {
      throw new RequestBodyError(
        new z.ZodError([
          {
            code: "custom",
            path: ["addOns", i, "serviceKeys"],
            message: "Choose from the Services listed",
            input: addOn.serviceKeys,
          },
        ]),
      );
    }
  }
};

// Saves a new version. Add-ons and Premises Types are never deleted: one left
// out of the submission is kept, retired.
export const savePriceList = async (
  input: PriceListInput,
  createdBy: string,
): Promise<PriceList> => {
  await checkServiceKeys(input);
  const current = await currentPriceList();
  const addOns = keepRetired(
    input.addOns,
    current.addOns,
    "addOns",
    "That Add-on isn't on the Price List any more; reload it",
  );
  const premisesTypes = keepRetired(
    input.premisesTypes,
    current.premisesTypes,
    "premisesTypes",
    "That Premises Type isn't on the Price List any more; reload it",
  );

  await db.transaction((tx) =>
    insertVersion(
      tx,
      { ...input, addOns, premisesTypes },
      { placeholder: false, createdBy },
    ),
  );
  return currentPriceList();
};

// The Add-ons a Client can pick now for a Service, by default the first on
// offer for homes: names only, never prices (those are on the Quote). Open
// to everyone, as the landing page's form needs it. A business's request
// picks none: its Site Visit comes first.
export const choosableAddOns = async (
  serviceKey: string,
): Promise<AddOnChoice[]> => {
  const [list, service] = await Promise.all([
    currentPriceList(),
    findService(serviceKey),
  ]);
  return list.addOns
    .filter((a) => a.active && a.serviceKeys.includes(service.key))
    .map(({ key, name }) => ({ key, name }));
};

// the Premises Types business premises can be described as now; open to
// everyone, for the landing page's form
export const choosablePremisesTypes = async (): Promise<
  PremisesTypeChoice[]
> => {
  const list = await currentPriceList();
  return list.premisesTypes
    .filter((p) => p.active)
    .map(({ key, name }) => ({ key, name }));
};
