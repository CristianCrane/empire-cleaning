// the JSON API, on the same origin (Vite forwards /api to the server)

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
    headers: body === undefined ? {} : { "content-type": "application/json" },
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
