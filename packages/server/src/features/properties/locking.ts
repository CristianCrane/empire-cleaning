import { eq } from "drizzle-orm";
import type { Tx } from "../../db/index.ts";
import { properties } from "./properties.schema.ts";

// holds a Property until the transaction ends, so what changes it takes
// turns: starting, sending and accepting its Quotes, and its Condition from
// its Jobs' completions
export const lockProperty = async (tx: Tx, propertyId: string) => {
  await tx
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .for("update");
};
