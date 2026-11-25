import { Link, type LinkProps } from "react-aria-components";
import { linkStyles } from "./Link.tsx";

// A prototype address (docs/ux.md, Changing a screen) with a name this
// branch has no prototype of: the ones it has, each a link to its list, or,
// with none, where a prototype comes from. The web app's prototype shell and
// the landing site's 404 page each draw it in development, so a name
// mistyped, or a branch mistaken, reads the same in both; a production build
// with no prototypes is Not found, as for any address it doesn't have
export function PrototypeUnknown({
  screen,
  known,
}: {
  screen: string;
  known: { name: string; href: LinkProps["href"] }[];
}) {
  return (
    <main className="mx-auto max-w-3xl p-4 text-sm">
      <p className="mb-1 text-base font-semibold">
        No prototype is named {screen} on this branch.
      </p>
      {known.length ? (
        <ul className="space-y-1">
          {known.map(({ name, href }) => (
            <li key={name}>
              <Link href={href} className={linkStyles()}>
                {name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          It has none: a prototype is made on a prototype-* branch, as
          docs/ux.md, Changing a screen, says.
        </p>
      )}
    </main>
  );
}
