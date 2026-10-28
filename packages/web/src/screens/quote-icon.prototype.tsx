// PROTOTYPE: throwaway. ?icon=A|B|C|D|E on any Office page. Question: which
// icon stands for a Quote, everywhere (side nav, New Quote, Today's rows)?
import { forwardRef, useSyncExternalStore } from "react";
import {
  Calculator,
  ClipboardPenLine,
  FilePenLine,
  FileText,
  HandCoins,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";

const variants = [
  { key: "A", name: "FileText: a document", icon: FileText },
  { key: "B", name: "Calculator: priced up", icon: Calculator },
  { key: "C", name: "ClipboardPenLine: written up", icon: ClipboardPenLine },
  { key: "D", name: "FilePenLine: drafted, to sign", icon: FilePenLine },
  { key: "E", name: "HandCoins: a price offered", icon: HandCoins },
];

let current = new URLSearchParams(window.location.search).get("icon") ?? "A";
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const useVariant = () => useSyncExternalStore(subscribe, () => current);

export const QuoteIcon = forwardRef<SVGSVGElement, LucideProps>(
  function QuoteIcon(props, ref) {
    const key = useVariant();
    const Icon = (variants.find((v) => v.key === key) ?? variants[0]!).icon;
    return <Icon ref={ref} {...props} />;
  },
) as LucideIcon;

export function QuoteIconSwitcher() {
  const key = useVariant();
  return (
    <PrototypeSwitcher
      variants={variants}
      current={key}
      onChange={(next) => {
        current = next;
        const url = new URL(window.location.href);
        url.searchParams.set("icon", next);
        window.history.replaceState(window.history.state, "", url);
        listeners.forEach((listener) => listener());
      }}
    />
  );
}
