import { AsyncLocalStorage } from "node:async_hooks";
import { afterEach } from "vitest";
import { db } from "#db";

// Inside db.transaction(), every query must go through its `tx`. One that
// goes through `db` waits for a second connection while the first holds its
// locks, so a burst of requests that each hold a connection while waiting on
// one lock can hang the whole API (#242). Tests refuse it outright, where
// it's written, instead of it hanging under load.
const inTransaction = new AsyncLocalStorage<true>();

const refuse = () => {
  if (inTransaction.getStore()) {
    throw new Error(
      "A query went through db inside db.transaction(): pass the transaction's tx instead",
    );
  }
};

const guarded = db as unknown as Record<
  string,
  (...args: unknown[]) => unknown
>;
for (const method of [
  "select",
  "selectDistinct",
  "selectDistinctOn",
  "insert",
  "update",
  "delete",
  "execute",
  "with",
  "$count",
]) {
  const original = guarded[method]!.bind(db);
  guarded[method] = (...args) => {
    refuse();
    return original(...args);
  };
}

// A transaction's queries share its one connection, so they run one after
// the other, never side by side through Promise.all: pg queues them now,
// but pg 9 won't (ADR-0024). A test that starts a second query while one is
// running fails once it ends, naming where that query was written: failing
// the query itself would leave its connection stuck.
type Client = { query: (...args: unknown[]) => unknown };
const builders = ["select", "selectDistinct", "insert", "update", "delete"];

// each pooled connection, watched once: how many queries it's running, and
// where the latest one built in a transaction was written (the one that
// overlaps, as each starts as soon as it's awaited). That's an Error whose
// stack is formatted only on an overlap. Formatting maps it through the
// source maps, and done for every query it took 7% of the CPU in a profile
// of the three biggest test files (#316)
const watched = new WeakMap<
  Client,
  { running: number; writtenAt: Error | undefined }
>();
const overlaps = new Set<Error>();

afterEach(() => {
  const found = [
    ...new Set(
      [...overlaps].map((at) => at.stack!.split("\n").slice(2, 6).join("\n")),
    ),
  ];
  overlaps.clear();
  if (found.length > 0) {
    throw new Error(
      `Two queries ran at once on one transaction: await them one after the other. Each second one was written\n${found.join("\n\n")}`,
    );
  }
});

const watch = (client: Client) => {
  const known = watched.get(client);
  if (known) return known;
  const state = { running: 0, writtenAt: undefined as Error | undefined };
  watched.set(client, state);
  const query = client.query.bind(client);
  client.query = (...args) => {
    if (state.running > 0) overlaps.add(state.writtenAt ?? new Error());
    const result = query(...args) as Promise<unknown> | undefined;
    // the pool's own queries, outside transactions, pass a callback instead
    if (result) {
      state.running++;
      const done = () => state.running--;
      result.then(done, done);
    }
    return result;
  };
  return state;
};

const oneAtATime = (tx: Record<string, unknown>) => {
  const state = watch((tx.session as { client: Client }).client);
  for (const method of [...builders, "execute"]) {
    const original = (tx[method] as (...args: unknown[]) => unknown).bind(tx);
    tx[method] = (...args: unknown[]) => {
      state.writtenAt = new Error();
      return original(...args);
    };
  }
};

const transaction = db.transaction.bind(db);
db.transaction = ((run, config) => {
  refuse();
  return transaction((tx) => {
    oneAtATime(tx as unknown as Record<string, unknown>);
    return inTransaction.run(true, () => run(tx));
  }, config);
}) as typeof db.transaction;
