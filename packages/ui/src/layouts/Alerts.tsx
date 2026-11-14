import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "../Button.tsx";
import { useUiWords } from "../language.ts";
import { Notice } from "../Notice.tsx";

// what a page says above itself: a Notice's tone, what it says, and at
// most one text Button for what to do about it
export type Alert = {
  key: string;
  tone?: "info" | "warning" | "success" | "danger";
  children: ReactNode;
  action?: ReactNode;
};

// how many show before "Show N more"
const SHOWN = 2;

// most pressing first: what went wrong, then what's the Office's to do
const order = { danger: 0, warning: 1, info: 2, success: 3 };

// A page's alerts, those that apply now (the rest false, null or
// undefined), most pressing first; never a wall of them: the first two,
// the rest a tap away. On screen only: what's to do about a record isn't
// on its printout (a Bill's)
export function Alerts({
  alerts,
}: {
  alerts: (Alert | false | null | undefined)[];
}) {
  const words = useUiWords();
  const [all, setAll] = useState(false);
  const shown = alerts
    .filter((a) => !!a)
    // a stable sort: each screen's order within a tone
    .sort((a, b) => order[a.tone ?? "info"] - order[b.tone ?? "info"]);
  if (shown.length === 0) return null;
  const hidden = all ? 0 : shown.length - SHOWN;
  return (
    <div className="flex flex-col gap-3 print:hidden">
      {shown.slice(0, hidden > 0 ? SHOWN : undefined).map((alert) => (
        <Notice key={alert.key} tone={alert.tone} action={alert.action}>
          {alert.children}
        </Notice>
      ))}
      {hidden > 0 && (
        <Button
          variant="text"
          className="-ms-3 self-start"
          onPress={() => setAll(true)}
        >
          <ChevronDown aria-hidden size={18} />
          {words.showMore(hidden)}
        </Button>
      )}
    </div>
  );
}
