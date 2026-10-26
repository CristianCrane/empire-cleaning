import type {
  QuoteRequestReceipt,
  QuoteRequestSubmission,
} from "@empire-cleaning/models";

export type SubmitResult<R = QuoteRequestReceipt> =
  | { ok: true; receipt: R }
  | {
      ok: false;
      // the API's per-field messages, keyed by the field's path (e.g. "contact.email")
      fieldErrors?: Record<string, string>;
      // the API refused the request and said why in words fit to show, e.g.
      // that this home already has a Quote Request waiting
      refusal?: string;
    };

// posts a Quote Request to `url`, and reads the API's answer: what it
// returned, its messages for each field, or why it refused
export const postQuoteRequest = async <R>(
  url: string,
  body: object,
  credentials: RequestCredentials,
): Promise<SubmitResult<R>> => {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials,
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false };
  }

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

  // 409: not wrong, just already asked
  if (res.status === 409) {
    const body = (await res.json()) as { message?: string };
    if (body.message) return { ok: false, refusal: body.message };
  }
  return { ok: false };
};

// posts a Quote Request to the API. A Guest's goes without cookies, so a
// visitor who happens to be signed in to the app is still treated as a Guest
// on the landing page; the portal's carries the session.
export const submitQuoteRequest = (
  apiUrl: string,
  submission: QuoteRequestSubmission,
  asGuest: boolean,
) =>
  postQuoteRequest<QuoteRequestReceipt>(
    `${apiUrl}/api/quote-requests`,
    submission,
    asGuest ? "omit" : "same-origin",
  );
