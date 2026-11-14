import { useContext, type ReactNode } from "react";
import { Logo } from "../Logo.tsx";
import { InAppLayout } from "./AppLayout.tsx";

// A page's frame. In an area it sits in AppLayout's frame, nav and all;
// anywhere else it's a page of its own, the logo above it (UX pass, #96;
// #168): narrow and centred, as a message or signing in
export function PageFrame({ children }: { children: ReactNode }) {
  if (useContext(InAppLayout)) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6">{children}</div>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Logo className="mx-auto w-44" />
      {children}
    </main>
  );
}
