// a list the form offers (Services, Add-ons, types of business), as the API
// has it now, signed out; empty if it can't be had (the API unreachable or
// refusing), and the form then says so or does without. What it can't read
// (a body that isn't JSON) is reported through the host's Sentry, which
// drops a dropped connection
export const loadList = async <T>(url: string): Promise<T[]> => {
  try {
    const res = await fetch(url, { credentials: "omit" });
    return res.ok ? ((await res.json()) as T[]) : [];
  } catch (e) {
    reportError(e);
    return [];
  }
};
