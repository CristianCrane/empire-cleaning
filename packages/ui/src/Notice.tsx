import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";
import { tv } from "./utils.ts";

// a message shown in the page itself, e.g. why a sign-in link didn't work.
// Danger notices are announced straight away; the others politely.
const notice = tv({
  base: "flex items-start gap-3 rounded-md p-4",
  variants: {
    tone: {
      info: "bg-info-subtle text-info-strong",
      success: "bg-success-subtle text-success-strong",
      danger: "bg-danger-subtle text-danger-strong",
    },
  },
});

const icons = { info: Info, success: CircleCheck, danger: CircleAlert };

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger";
  children: ReactNode;
}) {
  const Icon = icons[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={notice({ tone })}
    >
      <Icon aria-hidden size={20} className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
