// a list the form offers (Services, Add-ons, types of business), as the API
// has it now, signed out; empty if it can't be had (the API unreachable or
// refusing), and the form then says so or does without
export const loadList = async <T>(url: string): Promise<T[]> => {
  try {
    const res = await fetch(url, { credentials: "omit" });
    return res.ok ? ((await res.json()) as T[]) : [];
  } catch {
    return [];
  }
};
