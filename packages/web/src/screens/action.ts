import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { showToast } from "@empire-cleaning/ui";
import { ApiError } from "../api.ts";
import { CardProblem } from "./portal/CardForm.tsx";

export type ActionOptions = {
  // reload after a failure too, as what it would do may have changed since
  // the page loaded (a fee, the days with room)
  reloadOnFailure?: boolean;
  // shown beside the API's field errors, when it returns some
  fieldsProblem?: string;
};

export type Action = ReturnType<typeof useActionWith>;

/**
 * Runs a change someone asked for, then says it's done and reloads the
 * page's data. If it fails, shows why: the API's field errors, or the
 * message of a 409 or a card that couldn't be used as is, or else
 * `fallback`. Changes run one at a time; `pending` says which, when a
 * screen has more than one.
 */
export const useAction = (fallback: string, options: ActionOptions = {}) => {
  const router = useRouter();
  return useActionWith(() => router.invalidate(), fallback, options);
};

// useAction, given how to reload: the seam its tests use
export const useActionWith = (
  reload: () => Promise<unknown>,
  fallback: string,
  { reloadOnFailure = false, fieldsProblem }: ActionOptions = {},
) => {
  const [problem, setProblem] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string>();

  // `done` is the toast, worked out from what the change returned if it
  // depends on it; none if not given. Resolves to whether it worked.
  const run = async <T>(
    change: () => Promise<T>,
    done?: string | ((result: T) => string),
    which = "run",
  ) => {
    setPending(which);
    setProblem(undefined);
    setFieldErrors({});
    try {
      const result = await change();
      const title = typeof done === "function" ? done(result) : done;
      if (title) showToast({ tone: "success", title });
      await reload();
      return true;
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setFieldErrors(e.fieldErrors);
        setProblem(fieldsProblem);
      } else {
        setProblem(
          e instanceof CardProblem ||
            (e instanceof ApiError && e.status === 409)
            ? e.message
            : fallback,
        );
      }
      if (reloadOnFailure) await reload();
      return false;
    } finally {
      setPending(undefined);
    }
  };

  // stops before running a change, e.g. when something must be chosen first
  const fail = (message?: string, errors: Record<string, string> = {}) => {
    setProblem(message);
    setFieldErrors(errors);
  };

  return {
    run,
    fail,
    problem,
    fieldErrors,
    isPending: pending !== undefined,
    pending,
  };
};
