// the JSON API, on the same origin (Vite forwards /api to the server)

import { languageHeader } from "./language.ts";

export class ApiError extends Error {
  readonly status: number;
  // the API's per-field messages, keyed by the field's path (e.g. "email")
  readonly fieldErrors: Record<string, string>;
  // what sort of 409 it is, where its message alone can't tell a screen:
  // "approve", a payment the Client's bank wants them to approve (#534 Q7)
  readonly kind?: "approve";

  constructor(
    status: number,
    message: string,
    fieldErrors = {},
    kind?: "approve",
  ) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.kind = kind;
  }
}

const call = async <T>(method: string, path: string, body?: unknown) => {
  const res = await fetch(path, {
    method,
    headers: {
      ...languageHeader(),
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
      data?.kind,
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
