import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook } from "vitest-browser-react";
import { report } from "@empire-cleaning/browser-monitoring";
import { ApiError } from "../api.ts";
import { useLoaded } from "./load.ts";

vi.mock(import("@empire-cleaning/browser-monitoring"), async (original) => ({
  ...(await original()),
  report: vi.fn(),
}));

beforeEach(() => vi.mocked(report).mockClear());

// a load answered when the test says
const deferred = <T,>() => {
  let answer!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    answer = resolve;
    fail = reject;
  });
  return { promise, answer, fail };
};

type Props = { key?: string; load: () => Promise<object>; keep?: boolean };

const setup = (props: Props) =>
  renderHook(
    (now?: Props) => {
      const { key, load, keep } = now ?? props;
      return useLoaded(key, load, { keep });
    },
    { initialProps: props },
  );

describe("a load", () => {
  test("runs once for its key, and its value stays the same object", async () => {
    const value = { id: 1 };
    const load = vi.fn(async () => value);
    const { result, rerender } = await setup({ key: "a", load });

    await vi.waitFor(() => expect(result.current.value).toBe(value));
    // a re-render, even with a new load, never loads again
    await rerender({ key: "a", load: vi.fn(async () => ({ id: 2 })) });

    expect(load).toHaveBeenCalledOnce();
    expect(result.current.value).toBe(value);
  });

  test("for a new key shows nothing of the old one while it loads", async () => {
    const next = deferred<object>();
    const { result, rerender } = await setup({
      key: "a",
      load: async () => ({ id: 1 }),
    });
    await vi.waitFor(() => expect(result.current.value).toEqual({ id: 1 }));

    await rerender({ key: "b", load: () => next.promise });
    expect(result.current.value).toBeUndefined();
    next.answer({ id: 2 });

    await vi.waitFor(() => expect(result.current.value).toEqual({ id: 2 }));
  });

  test("an older key's answer arriving late is never shown", async () => {
    const older = deferred<object>();
    const { result, rerender } = await setup({
      key: "a",
      load: () => older.promise,
    });

    await rerender({ key: "b", load: async () => ({ id: 2 }) });
    await vi.waitFor(() => expect(result.current.value).toEqual({ id: 2 }));
    older.answer({ id: 1 });
    await older.promise;

    expect(result.current.value).toEqual({ id: 2 });
  });

  test("with no key loads nothing, and forgets what it had", async () => {
    const load = vi.fn(async () => ({ id: 1 }));
    const { result, rerender } = await setup({ key: "a", load });
    await vi.waitFor(() => expect(result.current.value).toEqual({ id: 1 }));

    await rerender({ key: undefined, load });
    expect(result.current.value).toBeUndefined();
    // back to the same key, it loads afresh: a card form starts a new setup
    await rerender({ key: "a", load });

    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});

describe("a load that fails", () => {
  test("is reported when it isn't the API's answer, and failed for its key", async () => {
    const bug = new TypeError("found is undefined");
    const { result } = await setup({
      key: "a",
      load: () => Promise.reject(bug),
    });

    await vi.waitFor(() => expect(result.current.failed).toBe(true));
    expect(report).toHaveBeenCalledWith(bug);
    expect(result.current.value).toBeUndefined();
  });

  test("isn't reported when it's the API's answer", async () => {
    const { result } = await setup({
      key: "a",
      load: () => Promise.reject(new ApiError(500, "Server error")),
    });

    await vi.waitFor(() => expect(result.current.failed).toBe(true));
    expect(report).not.toHaveBeenCalled();
  });

  test("is forgotten on a new key: a new attempt starts unfailed", async () => {
    const next = deferred<object>();
    const { result, rerender } = await setup({
      key: "0",
      load: () => Promise.reject(new ApiError(500, "Server error")),
    });
    await vi.waitFor(() => expect(result.current.failed).toBe(true));

    await rerender({ key: "1", load: () => next.promise });

    expect(result.current.failed).toBe(false);
  });
});

describe("keep", () => {
  test("holds the last value while the next loads, and when it fails", async () => {
    const next = deferred<object>();
    const { result, rerender } = await setup({
      key: "a",
      load: async () => ({ count: 3 }),
      keep: true,
    });
    await vi.waitFor(() => expect(result.current.value).toEqual({ count: 3 }));

    await rerender({ key: "b", load: () => next.promise, keep: true });
    expect(result.current.value).toEqual({ count: 3 });
    next.fail(new ApiError(500, "Server error"));

    await vi.waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.value).toEqual({ count: 3 });
  });
});
