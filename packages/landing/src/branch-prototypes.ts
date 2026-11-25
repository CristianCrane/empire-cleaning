import type { Prototype } from "./prototype.ts";

// every prototype on the branch (src/prototype.ts), by name, loaded when
// asked for, as each one's list imports `prototype` from there. Apart from
// src/prototype.ts, as import.meta.glob is Vite's, and the shots' test
// (tests/prototype.shots.ts) reads the addresses there under plain Node
const lists = import.meta.glob<{ default: Prototype }>("./prototypes/*.ts");
export const prototypes = async () =>
  Object.fromEntries(
    await Promise.all(
      Object.entries(lists).map(
        async ([file, load]) =>
          [file.replace(/^.*\/|\.ts$/g, ""), (await load()).default] as const,
      ),
    ),
  );
