import { Link, type LinkProps } from "react-aria-components";
import { linkStyles } from "./Link.tsx";

type Choice = { key: string; name: string };

// A prototype's list of everything it draws (docs/ux.md, Changing a
// screen): a row a case, a column a layout, each cell the link to that
// layout of that case. The web app's prototype shell and the landing site's
// prototype page each draw it with no case picked; the landing site as
// plain HTML, its links plain links. `pnpm pr:shots --prototype` shoots
// every link it marks, read by its data-* (prototype-shots.ts)
export function PrototypeIndex({
  screen,
  layouts,
  cases,
  hrefOf,
  missing,
}: {
  screen: string;
  layouts: Choice[];
  cases: Choice[];
  hrefOf: (layout: string, shown: string) => LinkProps["href"];
  // a case or layout asked for in the address that the prototype hasn't
  missing?: string;
}) {
  const cell = "px-2 py-1 text-start align-top";
  return (
    <main className="mx-auto max-w-3xl p-4 text-sm">
      <p className="mb-1 text-base font-semibold">{screen}</p>
      {missing && <p className="mb-1">{missing}</p>}
      <table className="-mx-2">
        <thead>
          <tr>
            <th scope="col" className={cell}>
              <span className="sr-only">Case</span>
            </th>
            {layouts.map((layout) => (
              <th key={layout.key} scope="col" className={cell}>
                {layout.key}{" "}
                <span className="font-normal text-fg-muted">{layout.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.map((shown) => (
            <tr key={shown.key} className="border-t border-border">
              <th scope="row" className={cell}>
                {shown.key}{" "}
                <span className="font-normal text-fg-muted">{shown.name}</span>
              </th>
              {layouts.map((layout) => (
                <td key={layout.key} className={cell}>
                  <Link
                    href={hrefOf(layout.key, shown.key)}
                    aria-label={`${shown.key} ${shown.name}, layout ${layout.key} ${layout.name}`}
                    data-prototype-shot=""
                    data-layout={layout.key}
                    data-layout-name={layout.name}
                    data-case={shown.key}
                    data-case-name={shown.name}
                    className={linkStyles()}
                  >
                    {layout.key}
                    {shown.key}
                  </Link>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
