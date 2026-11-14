import { useContext, type ReactNode } from "react";
import { Logo } from "../Logo.tsx";
import { InAppLayout } from "./AppLayout.tsx";

// A page's frame. In an area it sits in AppLayout's frame, nav and all;
// anywhere else it's a page of its own, the logo above it (UX pass, #96;
// #168): narrow and centred, as a message or signing in, or `wide`, as a
// Form page, who's signed in (`account`) beside the logo
export function PageFrame({
  wide = false,
  account,
  children,
}: {
  wide?: boolean;
  account?: ReactNode;
  children: ReactNode;
}) {
  if (useContext(InAppLayout)) {
    return (
      <div className={`flex flex-col gap-6 ${wide ? "" : "mx-auto max-w-md"}`}>
        {children}
      </div>
    );
  }
  if (wide) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 p-4 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
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
