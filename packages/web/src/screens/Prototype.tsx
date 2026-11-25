import type { ReactNode } from "react";
import {
  notFound,
  useLoaderData,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { Link, PrototypeBar, PrototypeIndex } from "@empire-cleaning/ui";
import { linkTo } from "../links.ts";

// The web app's prototype shell (docs/ux.md, Changing a screen). A prototype
// is a file named `<screen>.prototype.tsx` anywhere under src/screens, on a
// prototype-* branch, that default-exports prototype({ layouts, cases });
// /prototype/<screen>, signed out, draws it: `?layout=&case=` pick what's
// on show, and with no case, or one it hasn't, it's the list of every
// layout × case (PrototypeIndex), which `pnpm pr:shots --prototype
// <screen>` shoots one by one (packages/server/tests/e2e/prototype-shots.ts).
// Each case draws its own state from made-up data: a dialog open, a Fold's
// defaultOpen, a LanguageProvider for Spanish, the real frames through
// AreaLayout's PrototypeFrame. The screen-layout lint is off in a prototype
// file (.oxlintrc.json), and the copies check skips its words
// (packages/lint/README.md)

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
const screenOf = (path: string) => path.replace(/^.*\/|\.prototype\.tsx$/g, "");

// the route's loader: the prototype named, if this branch has it. A
// branch with none, such as main, has no such page: Not found, as for any
// address the app doesn't have
export const loadPrototype = async (screen: string) => {
  if (!Object.keys(files).length) throw notFound();
  const load = Object.entries(files).find(
    ([path]) => screenOf(path) === screen,
  )?.[1];
  return load && (await load()).default;
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
  if (!drawn) return <Unknown screen={screen} />;
  const caseKeys = Object.keys(drawn.cases);
  const hrefOf = (layout: string, shown: string) =>
    linkTo({
      to: "/prototype/$screen",
      params: { screen },
      search: { layout, case: inAddress(shown) },
    });
  const shown = search.case === undefined ? undefined : String(search.case);
  const layout =
    search.layout === undefined
      ? drawn.layouts[0]?.key
      : drawn.layouts.find(({ key }) => key === search.layout)?.key;
  // what the address asks for that the prototype hasn't
  const missing = [
    ...(shown !== undefined && !drawn.cases[shown] ? [`case ${shown}`] : []),
    ...(layout === undefined ? [`layout ${search.layout}`] : []),
  ];
  if (shown === undefined || !drawn.cases[shown] || layout === undefined) {
    return (
      <PrototypeIndex
        screen={screen}
        layouts={drawn.layouts}
        cases={caseKeys.map((key) => ({
          key,
          name: drawn.cases[key]?.name ?? "",
        }))}
        hrefOf={hrefOf}
        {...(missing.length && {
          missing: `It has no ${missing.join(" or ")}: pick one here.`,
        })}
      />
    );
  }
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
      {import.meta.env.DEV && (
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
          index={linkTo({ to: "/prototype/$screen", params: { screen } })}
        />
      )}
    </>
  );
}

// a name this branch has no prototype of, and the ones it has
function Unknown({ screen }: { screen: string }) {
  const known = Object.keys(files).map(screenOf).sort();
  return (
    <main className="mx-auto max-w-3xl p-4 text-sm">
      <p className="mb-1 text-base font-semibold">
        No prototype is named {screen} on this branch.
      </p>
      <ul className="space-y-1">
        {known.map((name) => (
          <li key={name}>
            <Link
              href={linkTo({
                to: "/prototype/$screen",
                params: { screen: name },
              })}
            >
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
