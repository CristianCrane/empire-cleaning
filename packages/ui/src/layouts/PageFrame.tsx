import { createContext, useContext, type ReactNode } from "react";
import { Logo } from "../Logo.tsx";
import { InAppLayout } from "./AppLayout.tsx";

// A page's frame. In an area it sits in AppLayout's frame, nav and all;
// anywhere else it's a page of its own, the logo above it (UX pass, #96;
// #168): narrow and centred, as a message or signing in; a form's width, as
// a Form page in one column (docs/ux.md, Forms: in an area at the content's
// start, so its title sits where every page's does; outside one centred,
// the logo above it, who's signed in (`account`) under the logo on a phone
// and beside it from sm); or `wide`, a Form page with its aside, the
// content's width
// in an area, the frame's column inside the content's: the header that
// sticks (PageHeader) keeps it too, so its actions stay over the title
// row's when a page is narrower than the content
const frameColumn = {
  narrow: "mx-auto max-w-md",
  form: "max-w-form",
  wide: "",
};
export const FrameColumn = createContext("");

export function PageFrame({
  width = "narrow",
  account,
  children,
}: {
  width?: "narrow" | "form" | "wide";
  account?: ReactNode;
  children: ReactNode;
}) {
  if (useContext(InAppLayout)) {
    const column = frameColumn[width];
    return (
      <FrameColumn value={column}>
        <div className={`flex flex-col gap-6 ${column}`}>{children}</div>
      </FrameColumn>
    );
  }
  if (width !== "narrow") {
    return (
      <main
        // a form's width inside its margins, as in an area
        className={`mx-auto flex min-h-dvh flex-col gap-6 p-4 py-10 ${width === "form" ? "box-content max-w-form" : "max-w-6xl"}`}
      >
        {/* who's signed in goes under the logo on a phone and beside it from
            sm, one breakpoint, so what's in it can line up by the same one */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo className="w-32" />
          {account}
        </header>
        {children}
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Logo className="mx-auto w-44" />
      {children}
    </main>
  );
}
