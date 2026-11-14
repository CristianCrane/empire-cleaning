import { useNavigate, useSearch } from "@tanstack/react-router";
import { LIST_PAGE } from "@empire-cleaning/ui";

// A List's place in the URL (docs/ux.md, List): what's searched for, the
// Tab picked, and where the server pages it, how many Show more has brought
// up to. Coming Back from one of its rows keeps them
export type ListUrl<T extends string> = {
  q?: string;
  tab?: T;
  shown?: number;
};

// a List route's validateSearch
export const listUrl =
  <T extends string>(tabs: readonly T[]) =>
  (search: Record<string, unknown>): ListUrl<T> => ({
    // a number-like search (a house number, "718555") comes back from the
    // URL as a number
    q:
      typeof search.q === "string" || typeof search.q === "number"
        ? String(search.q) || undefined
        : undefined,
    tab: tabs.find((t) => t === search.tab),
    shown:
      typeof search.shown === "number" && search.shown > LIST_PAGE
        ? Math.floor(search.shown)
        : undefined,
  });

// what a List the server pages asks it for: the Tab's page, or while
// searching, every Tab's, since a search looks through them all
export const listAsk = <T extends string>(
  tabs: readonly T[],
  { q, tab, shown }: ListUrl<T>,
) => ({
  q,
  tab: q ? ("all" as const) : tabShown(tabs, tab),
  shown: shown ?? LIST_PAGE,
});

// the Tab shown: the one picked, else the first that holds anything (a
// Client with only past cleans), else the first. A list the server pages
// asks for its Tab before it knows the counts, so opens on its first
export const tabShown = <T extends string>(
  tabs: readonly T[],
  picked: T | undefined,
  count?: (tab: T) => number,
): T => picked ?? (count && tabs.find((t) => count(t) > 0)) ?? tabs[0]!;

// the List's URL, its route's listUrl, and what its Tabs, search and Show
// more change in it
export function useListUrl<T extends string>() {
  const url = useSearch({ strict: false });
  const search = url as ListUrl<T>;
  const navigate = useNavigate();
  const go = (change: ListUrl<T>) =>
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, ...change }) as typeof prev,
      replace: true,
      resetScroll: false,
    });
  return {
    ...search,
    q: search.q ?? "",
    onTabChange: (tab: string) => go({ tab: tab as T, shown: undefined }),
    onSearch: (q: string) => go({ q: q || undefined, shown: undefined }),
    // the server's next page
    onMore: () => go({ shown: (search.shown ?? LIST_PAGE) + LIST_PAGE }),
  };
}
