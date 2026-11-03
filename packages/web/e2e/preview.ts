// serves the built app once per slot (e2e/slots.ts), each sending /api to its
// slot's API. Started by Playwright after `vite build` (playwright.config.ts).
// Without vite.config.ts: serving dist/ needs none of its plugins, and loading
// them once per slot slowed the start.
import { preview } from "vite";
import { slotOf, WORKERS } from "./slots.ts";

const root = new URL("..", import.meta.url).pathname;

for (let i = 0; i < WORKERS; i++) {
  const { appUrl, apiUrl } = slotOf(i);
  await preview({
    configFile: false,
    root,
    preview: {
      port: Number(new URL(appUrl).port),
      strictPort: true,
      proxy: { "/api": apiUrl },
    },
  });
  console.log(`app for slot ${i} on ${appUrl}`);
}
