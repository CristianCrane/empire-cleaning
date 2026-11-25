import type { ReactNode } from "react";
import {
  notFound,
  useLoaderData,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { Link, PrototypeBar } from "@empire-cleaning/ui";
import { linkTo } from "../links.ts";

// The web app's prototype shell (docs/ux.md, Changing a screen). A prototype
// is a file named `<screen>.prototype.tsx` anywhere under src/screens, on a
// prototype-* branch, that default-exports prototype({ layouts, cases });
// /prototype/<screen>, signed out, draws it: `?layout=&case=` pick what's
// on show, and with no case it's an index linking every layout × case,
// which `pnpm pr:shots --prototype <screen>` shoots one by one
// (packages/server/tests/e2e/prototype-shots.ts). Each case draws its own
// state from made-up data: a dialog open, a Fold's defaultOpen, a
// LanguageProvider for Spanish, the real frames through AreaLayout's navFor.
// The screen-layout lint is off in a prototype file (.oxlintrc.json), and
// the copies check skips its words (packages/lint/README.md)

/** @public a case's way to another layout or case, as a press would go */
export type Go<Layout extends string = string> = (to: {
  layout?: Layout;
  case?: string;
}) => void;

type Prototype<Layout extends string = string> = {
  layouts: { key: Layout; name: string }[];
  cases: Record<
    string,
    { name: string; draw: (layout: Layout, go: Go<Layout>) => ReactNode }
  >;
};

/** @public what a prototype file default-exports, its layouts in order */
export const prototype = <const Layout extends string>(
  drawn: Prototype<Layout>,
) => drawn as unknown as Prototype;

const files = import.meta.glob<{ default: Prototype }>("./**/*.prototype.tsx");

// the route's loader: the prototype named, or Not found
export const loadPrototype = async (screen: string) => {
  const load = Object.entries(files).find(([path]) =>
    path.endsWith(`/${screen}.prototype.tsx`),
  )?.[1];
  if (!load) throw notFound();
  return (await load()).default;
};

export type PrototypeSearch = { layout?: string; case?: string | number };

// a case's key as the address carries it: a number as a number, as the
// router writes a string that reads as one in quotes (case=%222%22)
const inAddress = (key: string) => (/^\d+$/.test(key) ? Number(key) : key);

export function PrototypeScreen() {
  const from = "/prototype/$screen";
  const { screen } = useParams({ from });
  const search = useSearch({ from });
  const drawn = useLoaderData({ from });
  const navigate = useNavigate();
  const caseKeys = Object.keys(drawn.cases);
  const hrefOf = (layout: string, shown: string) =>
    linkTo({
      to: "/prototype/$screen",
      params: { screen },
      search: { layout, case: inAddress(shown) },
    });
  if (search.case === undefined) {
    return (
      <main className="mx-auto max-w-prose p-4">
        <p className="mb-2 font-semibold">{screen}</p>
        <ul className="space-y-1">
          {caseKeys.flatMap((key) =>
            drawn.layouts.map((layout) => (
              <li key={`${layout.key}-${key}`}>
                <Link
                  href={hrefOf(layout.key, key)}
                  data-prototype-shot=""
                  data-layout={layout.key}
                  data-layout-name={layout.name}
                  data-case={key}
                  data-case-name={drawn.cases[key]?.name}
                >
                  {key} {drawn.cases[key]?.name}, layout {layout.key}{" "}
                  {layout.name}
                </Link>
              </li>
            )),
          )}
        </ul>
      </main>
    );
  }
  const [first] = drawn.layouts;
  const layout =
    drawn.layouts.find(({ key }) => key === search.layout)?.key ??
    first?.key ??
    "";
  const asked = String(search.case);
  const shown = drawn.cases[asked] ? asked : (caseKeys[0] ?? "");
  const go: Go = (to) =>
    void navigate({
      to: "/prototype/$screen",
      params: { screen },
      search: {
        layout: to.layout ?? layout,
        case: inAddress(to.case ?? shown),
      },
    });
  return (
    <>
      {/* drawn afresh for each, so no state carries over; the shots wait
          for it (prototype-shots.ts) */}
      <div
        key={`${layout}-${shown}`}
        data-prototype-case=""
        className="contents"
      >
        {drawn.cases[shown]?.draw(layout, go)}
      </div>
      <PrototypeBar
        layouts={drawn.layouts.map(({ key, name }) => ({
          key,
          name,
          href: hrefOf(key, shown),
        }))}
        cases={caseKeys.map((key) => ({
          key,
          name: drawn.cases[key]?.name ?? "",
          href: hrefOf(layout, key),
        }))}
        layout={layout}
        case={shown}
      />
    </>
  );
}
