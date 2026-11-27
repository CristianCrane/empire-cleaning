import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { tv } from "./utils.ts";

// a message shown in the page itself, e.g. why a sign-in link didn't work.
// Danger notices are announced straight away; the others politely. A notice
// is passing news, never the page's main action: it holds at most one
// action, a text Button on the right of its text. Two things to say or do
// are two notices. Its tone means what a status's does: info just so,
// warning someone needs to act, success done, danger went wrong. One that
// answers a press (`answers`) takes the focus as it shows, mid-screen, so
// it's in view and read out wherever the button was (#534 UX U4).
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
  answers = false,
  children,
}: {
  tone?: "info" | "warning" | "success" | "danger";
  answers?: boolean;
  // what to do about it: one Button, variant "text" (or "danger-text"),
  // size md, the size its hang on a phone fits (below)
  action?: ReactNode;
  children: ReactNode;
}) {
  const Icon = icons[tone];
  const self = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!answers) return;
    self.current?.focus({ preventScroll: true });
    // mid-screen, clear of a bar pinned at the top or the foot
    self.current?.scrollIntoView({ block: "center" });
  }, [answers]);
  return (
    <div
      ref={self}
      role={tone === "danger" ? "alert" : "status"}
      tabIndex={answers ? -1 : undefined}
      className={notice({ tone, class: answers && "outline-none" })}
    >
      {/* a line's height, so the icon centres on the first line of text */}
      <span className="flex h-6 shrink-0 items-center">
        <Icon aria-hidden size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
        {/* centred on the first line too: a Button is taller than a line */}
        {/* under the text on a phone, a text Button's padding hangs out to
            the left so its words line up with the text (UX review U11): by
            md's padding, as Button's flush="start" does (Button.tsx), so
            the action is md (review F19) */}
        {action && (
          <div className="-my-1.5 -ms-4 shrink-0 sm:-my-2.5 sm:ms-0">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
