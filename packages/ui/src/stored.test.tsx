import { afterEach, describe, expect, test, vi } from "vitest";
import { readStored, store } from "./stored.ts";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe.each(["localStorage", "sessionStorage"] as const)("%s", (kind) => {
  test("keeps a value, reads it back, and removes it with null", () => {
    store(kind, "ec-test", "dark");
    expect(readStored(kind, "ec-test")).toBe("dark");

    store(kind, "ec-test", null);
    expect(readStored(kind, "ec-test")).toBeNull();
  });

  // a private window, or site data turned off: even looking it up throws
  test("blocked, reads nothing and drops what's written, never throwing", () => {
    window[kind].setItem("ec-test", "dark");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    vi.spyOn(window, kind, "get").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });

    expect(readStored(kind, "ec-test")).toBeNull();
    expect(() => store(kind, "ec-test", "light")).not.toThrow();
    expect(() => store(kind, "ec-test", null)).not.toThrow();
    expect(setItem).not.toHaveBeenCalled();
  });
});
