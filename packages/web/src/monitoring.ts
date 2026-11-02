import { report } from "@empire-cleaning/browser-monitoring";
import { ApiError } from "./api.ts";
import { CardProblem } from "./screens/portal/CardForm.tsx";

// Errors nothing caught are reported by Sentry itself (started in main.tsx);
// those a screen catches, by this, unless it's an answer from the API (a 5xx
// is reported by the server, a 4xx is normal business) or a card that
// couldn't be used as is
export const reportUnexpected = (error: unknown) => {
  if (error instanceof ApiError || error instanceof CardProblem) return;
  report(error);
};
