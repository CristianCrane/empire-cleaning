// serves the built app once per slot (e2e/slots.ts), each sending /api to its
// slot's API. Started by Playwright after `vite build` (playwright.config.ts).
import { preview } from "vite";
import { slotOf, WORKERS } from "./slots.ts";

for (let i = 0; i < WORKERS; i++) {
  const { appUrl, apiUrl } = slotOf(i);
  await preview({
    preview: {
      port: Number(new URL(appUrl).port),
      strictPort: true,
      proxy: { "/api": apiUrl },
    },
  });
  console.log(`app for slot ${i} on ${appUrl}`);
}
