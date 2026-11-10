// the JSON API, on the same origin (Vite forwards /api to the server)

import type { Language } from "@empire-cleaning/models";

// the language the app's screens are in: English until they come in Spanish
// (#303). The API answers in it (ADR-0025), so it's said on every request,
// as otherwise the browser says its own
export const APP_LANGUAGE: Language = "en";
export const LANGUAGE_HEADER = { "accept-language": APP_LANGUAGE };

export class ApiError extends Error {
  readonly status: number;
  // the API's per-field messages, keyed by the field's path (e.g. "email")
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const call = async <T>(method: string, path: string, body?: unknown) => {
  const res = await fetch(path, {
    method,
    headers: {
      ...LANGUAGE_HEADER,
      ...(body !== undefined && { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : undefined;
  if (!res.ok) {
    const details: { path: string; issue: string }[] = data?.details ?? [];
    throw new ApiError(
      res.status,
      data?.message ?? res.statusText,
      Object.fromEntries(details.map((d) => [d.path, d.issue])),
    );
  }
  return data as T;
};

export const getJson = <T>(path: string) => call<T>("GET", path);
export const patchJson = <T>(path: string, body: unknown) =>
  call<T>("PATCH", path, body);
export const putJson = <T>(path: string, body: unknown) =>
  call<T>("PUT", path, body);
export const postJson = <T>(path: string, body?: unknown) =>
  call<T>("POST", path, body);
export const deleteJson = <T>(path: string) => call<T>("DELETE", path);
