import { AsyncLocalStorage } from "node:async_hooks";
import type { Language } from "@empire-cleaning/models";

// What's known about the request being served, wherever in it code runs:
// set once per request (middleware/request-context.ts), read by the logs,
// Sentry and whatever puts a reply into words

type RequestContext = {
  requestId: string;
  // the language the screen that asked is showing (Accept-Language), which
  // its reply's messages are in (ADR-0025)
  language: Language;
};

const requests = new AsyncLocalStorage<RequestContext>();

// runs `work` as part of a request: every log line and Sentry event from it
// carries the request's ID, and its messages are in the request's language
export const withRequest = <T>(context: RequestContext, work: () => T) =>
  requests.run(context, work);

export const currentRequestId = () => requests.getStore()?.requestId;

// the language of the request being served; English outside one (the
// scheduler) or when it named none. Read only where a reply is put into
// words: an email or a record goes by its own reader's language
export const currentLanguage = (): Language =>
  requests.getStore()?.language ?? "en";
