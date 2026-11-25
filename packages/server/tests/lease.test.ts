import { spawn } from "node:child_process";
import { once } from "node:events";
import type { Server } from "node:net";
import {
  afterAll,
  afterEach,
  beforeAll,
  expect,
  onTestFinished,
  test,
} from "vitest";
import {
  close,
  ephemeralStart,
  hold,
  type Lease,
  leaseRunPorts,
} from "./lease.ts";

// Each test works in small blocks of 10 inside a block of 200 leased from the
// real pool for this file, as an e2e run's (tests/ports.ts), so no run on the
// machine has its ports, and they open no others
let outer: Lease;
const SIZE = 10;
let blocks: number[];
beforeAll(async () => {
  outer = await leaseRunPorts({
    env: {},
    own: 10_000,
    blocks: Array.from({ length: 110 }, (_, i) => 10_000 + i * 200),
    size: 200,
    ephemeral: ephemeralStart(),
    log: () => {},
  });
  // 19 of them, up to the outer block's own lease port at +199
  blocks = Array.from({ length: 19 }, (_, i) => outer.base + i * SIZE);
});
afterAll(() => outer.release());

// leases and listeners a test takes, let go after it
let taken: (Lease | Server)[] = [];
afterEach(async () => {
  await Promise.all(
    taken.map((it) => ("release" in it ? it.release() : close(it))),
  );
  taken = [];
});

const lease = async (
  env: Record<string, string | undefined> = {},
  { own = blocks[0]!, ephemeral = 65_536 } = {},
) => {
  const lines: string[] = [];
  const it = await leaseRunPorts({
    env,
    own,
    blocks,
    size: SIZE,
    ephemeral,
    log: (line) => lines.push(line),
  });
  taken.push(it);
  return { ...it, lines };
};

const listen = async (port: number, host?: string) => {
  const server = await hold(port, host);
  if (!server) throw new Error(`${port} was taken already`);
  taken.push(server);
};

test("a second run from the same checkout takes the next block, and says why", async () => {
  const first = await lease();
  const second = await lease();
  expect(first.base).toBe(blocks[0]);
  expect(first.lines).toEqual([]);
  expect(second.base).toBe(blocks[1]);
  expect(second.lines).toEqual([
    `e2e ports: this checkout's ${blocks[0]}-${blocks[0]! + 9} can't be used, as another run holds it, so this run takes ${blocks[1]}-${blocks[1]! + 9}`,
  ]);
});

// as a stopped run's servers that went on: the API listens with no host, the
// control server on 127.0.0.1, the built app on localhost (::1 here first)
test.each([undefined, "127.0.0.1", "::1"])(
  "a block with a port listened on (host %s) and no run holding it is passed over",
  async (host) => {
    await listen(blocks[0]! + 4, host);
    const { base, lines } = await lease();
    expect(base).toBe(blocks[1]);
    expect(lines[0]).toContain("a port of it is in use with no run holding it");
  },
);

test("a run's block is free again once the run is killed", async () => {
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { takeBlock } from ${JSON.stringify(new URL("./lease.ts", import.meta.url).href)};
       const lease = await takeBlock(${blocks[0]}, ${SIZE});
       console.log(lease === "held" || lease === "busy" ? lease : "holding");
       // until killed, or until this test's process is gone
       process.stdin.on("close", () => process.exit()).resume();`,
    ],
    { stdio: ["pipe", "pipe", "inherit"] },
  );
  // not left holding its block when the test fails before the kill
  onTestFinished(() => void child.kill("SIGKILL"));
  const [said] = await once(child.stdout!, "data");
  expect(String(said).trim()).toBe("holding");
  expect((await lease()).base).toBe(blocks[1]);

  child.kill("SIGKILL");
  await once(child, "exit");
  expect((await lease()).base).toBe(blocks[0]);
});

test("a process the run started uses the run's block, without leasing one", async () => {
  const env: Record<string, string | undefined> = {};
  const run = await lease(env);
  expect(env.E2E_PORT_LEASE).toBe(String(run.base));

  // as a Playwright worker, which inherits the run's environment
  expect((await lease({ ...env })).base).toBe(run.base);
  // and it holds nothing: once the run lets go, another run takes the block
  await run.release();
  expect((await lease()).base).toBe(run.base);
});

test("E2E_PORT_BASE pins a block, leased like any other", async () => {
  const env = { E2E_PORT_BASE: String(blocks[2]) };
  expect((await lease(env)).base).toBe(blocks[2]);
  expect(env).toHaveProperty("E2E_PORT_LEASE", String(blocks[2]));
});

test("E2E_PORT_BASE fails at once on a block another run holds", async () => {
  await lease();
  await expect(lease({ E2E_PORT_BASE: String(blocks[0]) })).rejects.toThrow(
    `E2E_PORT_BASE=${blocks[0]}: ports ${blocks[0]}-${blocks[0]! + 9} can't be used, as another run holds it`,
  );
});

test("E2E_PORT_BASE is refused in Linux's range for outgoing connections, or off the blocks", async () => {
  const ephemeral = blocks[3]! + 5;
  // a block reaching the range, and a port past every block (41000 by hand)
  for (const pin of [blocks[3]!, 60_000]) {
    await expect(
      lease({ E2E_PORT_BASE: String(pin) }, { ephemeral }),
    ).rejects.toThrow(
      `E2E_PORT_BASE=${pin}: its ports aren't all below ${ephemeral}, where Linux starts picking the ports of outgoing connections`,
    );
  }
  await expect(
    lease({ E2E_PORT_BASE: String(blocks[0]! + 5) }, { ephemeral }),
  ).rejects.toThrow(`isn't the start of a block of e2e ports`);
});

test("no run takes a block reaching Linux's range for outgoing connections", async () => {
  const ephemeral = blocks[3]! + 5;
  const bases = [];
  for (let i = 0; i < 3; i++) bases.push((await lease({}, { ephemeral })).base);
  expect(bases).toEqual(blocks.slice(0, 3));
  await expect(lease({}, { ephemeral })).rejects.toThrow(
    "no block of e2e ports is free: all 3",
  );
});
