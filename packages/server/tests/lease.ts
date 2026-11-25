import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:net";

// How an e2e run gets a block of ports no other run on the machine is using,
// with no one picking one (tests/ports.ts takes it). A run leases a block for
// as long as it lives: it listens on the block's last port, and the kernel
// lets that go when the run's process ends, however it ends (a kill -9 too),
// so there's no lock file to clean up and nothing to wait out. A block is
// taken only once its other ports are free too, so the servers of a run that
// was stopped while they kept going are stepped past, not run into.

export type Lease = { base: number; release: () => Promise<void> };

// listens on `port`, by `host` or on every address when none is given; null
// when something else has it. Unref'd, so it never keeps a process alive
export const hold = (port: number, host?: string) =>
  new Promise<Server | null>((resolve, reject) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        resolve(null);
      } else reject(error);
    });
    server.listen({ port, host }, () => resolve(server.unref()));
  });

export const close = (server: Server) =>
  new Promise<void>((resolve) => server.close(() => resolve()));

// whether every one of `ports` is free: each listens on every address (`::`,
// which takes IPv4 too) and lets go. That is refused by anything listening on
// the port on any address (127.0.0.1, ::1, localhost, 0.0.0.0), where the e2e
// servers listen on three different ones (tests/e2e/server.ts,
// packages/web/e2e/preview.ts). A port an outgoing connection uses doesn't
// refuse a listen, nor a server either
export const portsFree = async (ports: number[]) => {
  const held = await Promise.all(ports.map((port) => hold(port)));
  await Promise.all(held.flatMap((server) => (server ? [close(server)] : [])));
  return held.every(Boolean);
};

// the lease of the block of `size` ports from `base`, its last port listened
// on; null while a run holds it. Taken alone, whatever the block's other
// ports, it says no run is using the block, and keeps any from taking it
// meanwhile
export const holdLease = async (
  base: number,
  size: number,
): Promise<Lease | null> => {
  const server = await hold(base + size - 1, "127.0.0.1");
  return server && { base, release: () => close(server) };
};

// the block of `size` ports from `base`, leased: "held" when another run
// has it, "busy" when a port of it is in use with no run holding it
export const takeBlock = async (
  base: number,
  size: number,
): Promise<Lease | "held" | "busy"> => {
  const lease = await holdLease(base, size);
  if (!lease) return "held";
  const others = Array.from({ length: size - 1 }, (_, i) => base + i);
  if (!(await portsFree(others))) {
    await lease.release();
    return "busy";
  }
  return lease;
};

// where Linux picks the local ports of outgoing connections from: a server
// on a port in that range can be refused with nothing listening there
// (docs/testing-log.md, 2026-11-22 and 23), so no block reaches it
export const ephemeralStart = (
  path = "/proc/sys/net/ipv4/ip_local_port_range",
) => {
  try {
    const start = Number(readFileSync(path, "utf8").trim().split(/\s+/)[0]);
    return Number.isInteger(start) && start > 0 ? start : 32_768;
  } catch {
    return 32_768;
  }
};

const range = (base: number, size: number) => `${base}-${base + size - 1}`;

const why = {
  held: "another run holds it",
  busy: "a port of it is in use with no run holding it",
};

// The block this run's servers use. In order:
//   - a process a run started (a Playwright worker, a web server, a nested
//     run) finds the run's block in E2E_PORT_LEASE and uses it, as the run
//     holds it for as long as they live;
//   - E2E_PORT_BASE, how a block was picked by hand before runs leased
//     theirs, fails at once: whoever set it learns no one picks now, rather
//     than the run quietly taking other ports;
//   - otherwise the first free one of `blocks` below `ephemeral` (Linux's
//     range for outgoing connections), from `own` on (the checkout's own, so
//     a checkout keeps its ports while it can), saying why when it isn't
//     `own`.
// A block leased here goes in E2E_PORT_LEASE, for the processes the run
// starts.
export const leaseRunPorts = async ({
  env,
  own,
  blocks,
  size,
  ephemeral,
  log = (line) => console.error(line),
}: {
  env: Record<string, string | undefined>;
  own: number;
  blocks: number[];
  size: number;
  ephemeral: number;
  log?: (line: string) => void;
}): Promise<Lease> => {
  const handed = env.E2E_PORT_LEASE;
  if (handed !== undefined) {
    const base = Number(handed);
    if (!Number.isInteger(base)) {
      throw new Error(
        `E2E_PORT_LEASE is set by the run that holds a block of e2e ports, for the processes it starts, not by hand: "${handed}" isn't a port`,
      );
    }
    return { base, release: async () => {} };
  }

  const pinned = env.E2E_PORT_BASE;
  if (pinned !== undefined) {
    const outgoing =
      Number(pinned) + size > ephemeral
        ? ` Here it would also reach ${ephemeral}, where Linux starts picking the ports of outgoing connections (/proc/sys/net/ipv4/ip_local_port_range), so a server there can be refused with nothing listening.`
        : "";
    throw new Error(
      `E2E_PORT_BASE=${pinned}: an e2e run takes a free block of ports itself, so none is picked by hand.${outgoing} Leave E2E_PORT_BASE unset`,
    );
  }

  const pool = blocks.filter((base) => base + size <= ephemeral);
  const first = pool.findIndex((base) => base >= own);
  const order =
    first < 0 ? pool : [...pool.slice(first), ...pool.slice(0, first)];
  let ownWas: "held" | "busy" | undefined;
  for (const base of order) {
    const lease = await takeBlock(base, size);
    if (typeof lease === "string") {
      if (base === own) ownWas = lease;
      continue;
    }
    if (ownWas) {
      log(
        `e2e ports: this checkout's ${range(own, size)} can't be used, as ${why[ownWas]}${ownWas === "busy" ? ` (\`ss -ltnp 'sport >= :${own} and sport <= :${own + size - 1}'\` names it: a stopped run's servers?)` : ""}, so this run takes ${range(base, size)}`,
      );
    }
    env.E2E_PORT_LEASE = String(lease.base);
    return lease;
  }
  throw new Error(
    `no block of e2e ports is free: all ${pool.length} (${range(pool[0] ?? 0, pool.length * size)}) are held by other runs or have ports in use`,
  );
};
