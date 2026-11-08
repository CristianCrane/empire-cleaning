import { useEffect, useEffectEvent, useState } from "react";
import { reportUnexpected } from "../monitoring.ts";

/**
 * What a screen loads while it's shown. `key` holds everything `load` reads:
 * a new key loads again, and a re-render never does (each load of a card
 * form starts a payment with the provider). `value` is the one loaded for
 * this key, the same object until the key changes, so what's built on it
 * (a card box) isn't built again; with `keep`, the last one stays while the
 * next loads, or if it fails. No key loads nothing and forgets what was
 * loaded. A failure is reported unless it was the API's answer, and
 * `failed` holds for its key only.
 */
export function useLoaded<T>(
  key: string | undefined,
  load: () => Promise<T>,
  { keep = false }: { keep?: boolean } = {},
) {
  const [loaded, setLoaded] = useState<{
    key: string;
    value?: T;
    failed: boolean;
  }>();
  const loadNow = useEffectEvent(load);

  useEffect(() => {
    if (key === undefined) {
      setLoaded(undefined);
      return;
    }
    let current = true;
    loadNow().then(
      (value) => current && setLoaded({ key, value, failed: false }),
      (e: unknown) => {
        reportUnexpected(e);
        if (current) {
          setLoaded((last) => ({
            key,
            value: keep ? last?.value : undefined,
            failed: true,
          }));
        }
      },
    );
    return () => {
      current = false;
    };
  }, [key, keep]);

  const now = loaded !== undefined && loaded.key === key;
  return {
    value: now || keep ? loaded?.value : undefined,
    failed: now && loaded.failed,
  };
}
