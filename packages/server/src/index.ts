import { app } from "./server.ts";
import type { Test } from "@empire-cleaning/models";
import env from "./env.ts";

const a: Test = "A";

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
