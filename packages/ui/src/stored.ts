// Storage in this browser, which can be blocked (a private window, site data
// turned off), when even looking it up throws. Reading gives null then, and
// writing is dropped: what's kept there is only ever a convenience
type Kind = "localStorage" | "sessionStorage";

export const readStored = (kind: Kind, key: string): string | null => {
  try {
    return window[kind].getItem(key);
  } catch {
    return null;
  }
};

// a value of null removes the key
export const store = (kind: Kind, key: string, value: string | null) => {
  try {
    if (value === null) window[kind].removeItem(key);
    else window[kind].setItem(key, value);
  } catch {
    // not kept
  }
};
