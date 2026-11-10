import type { Language } from "@empire-cleaning/models";

// a list the form offers (Services, Add-ons, types of business), as the API
// has it now, signed out, named in the form's language; empty if it can't be
// had (the API unreachable or
// refusing), and the form then says so or does without. What it can't read
// (a body that isn't JSON) is reported through the host's Sentry, which
// drops a dropped connection
export const loadList = async <T>(
  url: string,
  lang: Language,
): Promise<T[]> => {
  try {
    const res = await fetch(url, {
      credentials: "omit",
      headers: { "accept-language": lang },
    });
    return res.ok ? ((await res.json()) as T[]) : [];
  } catch (e) {
    reportError(e);
    return [];
  }
};
