import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { afterEach, expect, test, vi } from "vitest";
import { APPLICATION_KEY } from "./application-key.ts";
import { monitoringBuild } from "./vite.ts";

let root: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (root) await rm(root, { recursive: true, force: true });
});

// The browser counts an uncaught error with no frame from our builds as
// someone else's and drops it (./index.ts), so a build without the mark would
// drop every one. Builds without SENTRY_AUTH_TOKEN (CI, a test site without
// one) must mark their code too (#458)
test("a build marks its code as ours, with or without a token", async () => {
  vi.stubEnv("SENTRY_AUTH_TOKEN", "");
  root = await mkdtemp(join(tmpdir(), "monitoring-build-"));
  await writeFile(join(root, "main.js"), "console.log('hi');\n");

  await build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: monitoringBuild("web"),
    build: {
      outDir: "dist",
      lib: { entry: join(root, "main.js"), formats: ["es"], fileName: "main" },
    },
  });

  const [file] = await readdir(join(root, "dist"));
  const code = await readFile(join(root, "dist", file!), "utf8");
  expect(code).toContain(`_sentryBundlerPluginAppKey:${APPLICATION_KEY}`);
  expect(await readdir(join(root, "dist"))).not.toContainEqual(
    expect.stringMatching(/\.map$/),
  );
});
