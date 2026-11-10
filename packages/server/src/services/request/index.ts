import { AsyncLocalStorage } from "node:async_hooks";

// What's known about the request being served, wherever in it code runs:
// set once per request (middleware/request-context.ts), read by the logs and
// Sentry

type RequestContext = { requestId: string };

const requests = new AsyncLocalStorage<RequestContext>();

// runs `work` as part of the request `requestId`: every log line and Sentry
// event from it carries the ID
export const withRequest = <T>(context: RequestContext, work: () => T) =>
  requests.run(context, work);

export const currentRequestId = () => requests.getStore()?.requestId;
