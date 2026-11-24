import type { ReactNode } from "react";
import { partsShown } from "@empire-cleaning/models";

type Part = ReactNode | false | null | undefined;

// A row's line of parts, set apart by dots: "41-12 Austin St, 4B, 11375 ·
// Standard Clean $194.89 · waiting since today" (docs/ux.md, Lists and
// tables). Each part stays whole where it fits, and a wrap never leaves a dot
// at a line's end or start: each dot sits in the gap before its part, and
// the gap of a part that starts a line falls in the margin this line hides.
// Its text reads "A · B · C". Where a slot takes only text, models' lineOf.
export function Line({ parts }: { parts: Part[] }) {
  const shown = partsShown(parts);
  if (shown.length === 0) return null;
  return (
    <span className="block overflow-hidden">
      <span className="-ml-[1.25em] flex flex-wrap">
        {shown.map((part, i) => (
          <span
            key={i}
            className="relative min-w-0 pl-[1.25em] [overflow-wrap:anywhere]"
          >
            {/* out of the flow, so a long part can't wrap after it */}
            {i > 0 && (
              <span className="absolute top-0 left-0 w-[1.25em] text-center whitespace-pre">
                {" · "}
              </span>
            )}
            {part}
          </span>
        ))}
      </span>
    </span>
  );
}
