// `pnpm pr:shots --prototype <screen>`'s run of a landing prototype,
// through this package's harness
// (packages/server/tests/e2e/prototype-shots.ts)
import { prototypeShots } from "@empire-cleaning/server/prototype-shots";
import { indexPath } from "../src/prototype.ts";
import { test } from "./harness.ts";

prototypeShots(test, indexPath);
