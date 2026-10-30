import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { tv } from "./utils.ts";

// a message shown in the page itself, e.g. why a sign-in link didn't work.
// Danger notices are announced straight away; the others politely. A notice
// is passing news, never the page's main action: it holds at most one
// action, a text Button on the right of its text. Two things to say or do
// are two notices. Its tone means what a status's does: info just so,
// warning someone needs to act, success done, danger went wrong.
const notice = tv({
  base: "flex items-start gap-3 rounded-md p-4",
  variants: {
    tone: {
      info: "bg-info-subtle text-info-strong",
      warning: "bg-warning-subtle text-warning-strong",
      success: "bg-success-subtle text-success-strong",
      danger: "bg-danger-subtle text-danger-strong",
    },
  },
});

const icons = {
  info: Info,
  warning: TriangleAlert,
  success: CircleCheck,
  danger: CircleAlert,
};

export function Notice({
  tone = "info",
  action,
  children,
}: {
  tone?: "info" | "warning" | "success" | "danger";
  // what to do about it: one Button, variant "text" (or "danger-text")
  action?: ReactNode;
  children: ReactNode;
}) {
  const Icon = icons[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={notice({ tone })}
    >
      {/* a line's height, so the icon centres on the first line of text */}
      <span className="flex h-6 shrink-0 items-center">
        <Icon aria-hidden size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
        {/* centred on the first line too: a Button is taller than a line */}
        {action && <div className="-my-1.5 shrink-0 sm:-my-2.5">{action}</div>}
      </div>
    </div>
  );
}
