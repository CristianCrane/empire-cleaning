import type { QuoteAskReceipt, QuoteAsk } from "@empire-cleaning/models";

export type SubmitResult<R = QuoteAskReceipt> =
  | { ok: true; receipt: R }
  | {
      ok: false;
      // the API's per-field messages, keyed by the field's path (e.g. "contact.email")
      fieldErrors?: Record<string, string>;
      // the API refused the request and said why in words fit to show, e.g.
      // that this home already has a Quote open, or to wait and try again
      refusal?: string;
    };

// posts an ask for a Quote to `url`, and reads the API's answer: what it
// returned, its messages for each field, or why it refused. One that can't
// be read (no connection, a body that isn't JSON) is a failure the form
// says, and is reported through the host's Sentry, which drops a dropped
// connection
export const postQuoteRequest = async <R>(
  url: string,
  body: object,
  credentials: RequestCredentials,
): Promise<SubmitResult<R>> => {
  try {
    return await answerOf<R>(
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials,
        body: JSON.stringify(body),
      }),
    );
  } catch (e) {
    reportError(e);
    return { ok: false };
  }
};

// the API's answer, read
const answerOf = async <R>(res: Response): Promise<SubmitResult<R>> => {
  if (res.ok) return { ok: true, receipt: (await res.json()) as R };

  if (res.status === 400) {
    const body = (await res.json()) as {
      details?: { path: string; issue: string }[];
    };
    if (body.details?.length) {
      return {
        ok: false,
        fieldErrors: Object.fromEntries(
          body.details.map(({ path, issue }) => [path, issue]),
        ),
      };
    }
  }

  // 409: not wrong, just already asked; 429: asked too often for now (#32)
  if (res.status === 409 || res.status === 429) {
    const body = (await res.json()) as { message?: string };
    if (body.message) return { ok: false, refusal: body.message };
  }
  return { ok: false };
};

// posts an ask for a Quote to the API. A Guest's goes without cookies, so a
// visitor who happens to be signed in to the app is still treated as a Guest
// on the landing page; the portal's carries the session.
export const submitQuoteRequest = (
  apiUrl: string,
  submission: QuoteAsk,
  asGuest: boolean,
) =>
  postQuoteRequest<QuoteAskReceipt>(
    `${apiUrl}/api/quotes/ask`,
    submission,
    asGuest ? "omit" : "same-origin",
  );
