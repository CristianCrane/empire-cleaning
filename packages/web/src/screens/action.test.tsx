import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook } from "vitest-browser-react";
import { showToast } from "@empire-cleaning/ui";
import { ApiError } from "../api.ts";
import { useActionWith, type ActionOptions } from "./action.ts";
import { CardProblem } from "./portal/CardForm.tsx";

vi.mock(import("@empire-cleaning/ui"), async (original) => ({
  ...(await original()),
  showToast: vi.fn(),
}));

const FALLBACK = "It wasn't saved. Please try again.";

const setup = async (options: ActionOptions = {}) => {
  const reload = vi.fn(async () => {});
  const { result, act } = await renderHook(() =>
    useActionWith(reload, FALLBACK, options),
  );
  // runs a change, and says whether it worked
  const run = async (...args: Parameters<typeof result.current.run>) => {
    let ok = false;
    await act(async () => {
      ok = await result.current.run(...args);
    });
    return ok;
  };
  return { reload, result, act, run };
};

beforeEach(() => vi.mocked(showToast).mockClear());

describe("a change that works", () => {
  test("says it's done and reloads the page's data", async () => {
    const { reload, result, run } = await setup();

    expect(await run(async () => {}, "Saved")).toBe(true);

    expect(showToast).toHaveBeenCalledWith({ tone: "success", title: "Saved" });
    expect(reload).toHaveBeenCalledOnce();
    expect(result.current.problem).toBeUndefined();
    expect(result.current.isPending).toBe(false);
  });

  test("words what it says from what the change returned", async () => {
    const { run } = await setup();

    await run(
      async () => "client@example.com",
      (to) => `Sent to ${to}`,
    );

    expect(showToast).toHaveBeenCalledWith({
      tone: "success",
      title: "Sent to client@example.com",
    });
  });

  test("is pending while it runs, under the name it was given", async () => {
    const { result, act } = await setup();
    let finish = () => {};
    let running: Promise<boolean> = Promise.resolve(false);
    await act(() => {
      running = result.current.run(
        () => new Promise<void>((resolve) => (finish = resolve)),
        undefined,
        "approve",
      );
    });

    expect(result.current.pending).toBe("approve");
    expect(result.current.isPending).toBe(true);
    await act(async () => {
      finish();
      await running;
    });
    expect(result.current.pending).toBeUndefined();
  });
});

describe("a change that fails", () => {
  test("shows a 409's message as is, and doesn't reload", async () => {
    const { reload, result, run } = await setup();

    const ok = await run(async () => {
      throw new ApiError(409, "That day is full.");
    }, "Saved");

    expect(ok).toBe(false);
    expect(result.current.problem).toBe("That day is full.");
    expect(reload).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  test("shows why a card couldn't be used as is", async () => {
    const { result, run } = await setup();

    await run(async () => {
      throw new CardProblem("Your card was declined.");
    });

    expect(result.current.problem).toBe("Your card was declined.");
  });

  test.each([
    ["a server error", new ApiError(500, "Internal Server Error")],
    ["no connection", new TypeError("Failed to fetch")],
  ])("shows the fallback for %s", async (_, error) => {
    const { result, run } = await setup();

    await run(async () => {
      throw error;
    });

    expect(result.current.problem).toBe(FALLBACK);
  });

  test("shows the API's field errors, beside its fields problem if given", async () => {
    const { result, run } = await setup({
      fieldsProblem: "Some details need fixing.",
    });

    await run(async () => {
      throw new ApiError(400, "Invalid", { email: "Enter an email" });
    });

    expect(result.current.fieldErrors).toEqual({ email: "Enter an email" });
    expect(result.current.problem).toBe("Some details need fixing.");
  });

  test("reloads too, when what it does may have changed", async () => {
    const { reload, run } = await setup({ reloadOnFailure: true });

    await run(async () => {
      throw new ApiError(409, "The fee has changed.");
    });

    expect(reload).toHaveBeenCalledOnce();
  });

  test("is cleared by the next try", async () => {
    const { result, run } = await setup();
    await run(async () => {
      throw new ApiError(400, "Invalid", { email: "Enter an email" });
    });

    await run(async () => {});

    expect(result.current.problem).toBeUndefined();
    expect(result.current.fieldErrors).toEqual({});
  });
});

test("fail shows a problem without running anything", async () => {
  const { reload, result, act } = await setup();

  await act(() =>
    result.current.fail(undefined, { condition: "Say how it was" }),
  );

  expect(result.current.fieldErrors).toEqual({ condition: "Say how it was" });
  expect(result.current.problem).toBeUndefined();
  expect(reload).not.toHaveBeenCalled();
});
