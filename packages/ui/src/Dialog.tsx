import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  type DialogProps as AriaDialogProps,
  type ModalOverlayProps,
} from "react-aria-components";
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useUiWords } from "./language.ts";
import { Button } from "./Button.tsx";
import { Overlay } from "./Overlay.tsx";

export { DialogTrigger } from "react-aria-components";

// what opens a dialog from code: whether it's open, and told when it closes
export type DialogState = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export type DialogProps = Omit<AriaDialogProps, "children"> & {
  title: string;
  children: ReactNode | ((opts: { close: () => void }) => ReactNode);
  // what the overlay passes through to the modal
  isDismissable?: ModalOverlayProps["isDismissable"];
  // to open it from code rather than a DialogTrigger, e.g. when something is
  // dropped: whether it's open, and told when it closes
  isOpen?: ModalOverlayProps["isOpen"];
  onOpenChange?: ModalOverlayProps["onOpenChange"];
  // lg, a form's width, for a form with rows of choices, e.g. what a Site
  // Visit found; wide for something that needs the room, e.g. a week's
  // calendar
  size?: "md" | "lg" | "wide";
};

// a modal dialog: a sheet rising from the bottom on a phone, centred on larger
// screens. Use inside a DialogTrigger after the Button that opens it (or pass
// isOpen and onOpenChange), and end it with an <Actions> row of at most two
// Buttons: one filled (primary, or danger for what can't be got back: the
// `ui` skill) and one quiet (Cancel, or an alternative such as Dismiss). The
// ✕ in its corner closes it without doing anything. Never open a dialog on a
// dialog: a second look is a step in the same one. For a confirmation asked
// once more, pass role="alertdialog" (not dismissable by tapping outside).
// At every width its title row and its Actions row stay in view while what's
// between them scrolls: the facts read before the decision, the decision
// always in reach, and the reader never loses which dialog this is (docs/ux.md,
// Dialogs and rows). Each row draws its line only while something lies under
// it.
export function Dialog({
  title,
  children,
  isDismissable,
  isOpen,
  onOpenChange,
  size = "md",
  ...props
}: DialogProps) {
  const isAlert = props.role === "alertdialog";
  const words = useUiWords();
  const { body, top, end, more } = useMoreOutOfView();

  return (
    <Overlay
      isDismissable={isDismissable ?? !isAlert}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="flex items-end justify-center sm:items-center sm:p-4"
    >
      <Modal
        className={`flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-xl bg-overlay text-fg shadow-overlay entering:animate-in entering:slide-in-from-bottom-8 exiting:animate-out exiting:slide-out-to-bottom-8 sm:rounded-lg ${{ md: "sm:max-w-md", lg: "sm:max-w-form", wide: "sm:max-w-6xl" }[size]}`}
      >
        <AriaDialog {...props} className="flex min-h-0 flex-col outline-none">
          {({ close }) => (
            <>
              {/* the title row, outside what scrolls; its line, the slim
                  header's (PageHeader), while the body runs on above it */}
              <div
                className={`relative z-10 flex items-start gap-3 border-b px-5 pt-5 pb-3 ${more.above ? "border-border shadow-raised" : "border-transparent"}`}
              >
                <Heading
                  slot="title"
                  className="flex-1 font-display text-2xl font-bold tracking-wide uppercase"
                >
                  {title}
                </Heading>
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label={words.close}
                  onPress={close}
                  className="-mt-2 -mr-2 shrink-0"
                >
                  <X aria-hidden size={20} />
                </Button>
              </div>
              {/* the body, which scrolls: room at its foot for the Actions
                  row under a field brought into view (two Buttons stacked
                  on a phone, the most a dialog has, and the safe area; one
                  line from sm) */}
              <div
                ref={body}
                className="min-h-0 overflow-auto scroll-pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:scroll-pb-[calc(5.25rem+env(safe-area-inset-bottom))]"
              >
                {/* its padding, and its Actions row (data-actions) sticky at
                    its foot, as the page's ActionFooter looks: as wide as the
                    dialog, raised over what scrolls under it, taking the
                    padding at the foot (the safe area's) as its own */}
                <div
                  className={`relative flex flex-col gap-4 px-5 pt-1 pb-(--foot) [--foot:max(1.25rem,env(safe-area-inset-bottom))] [&_[data-actions]]:sticky [&_[data-actions]]:bottom-0 [&_[data-actions]]:z-10 [&_[data-actions]]:-mx-5 [&_[data-actions]]:-mb-(--foot) [&_[data-actions]]:border-t [&_[data-actions]]:bg-overlay [&_[data-actions]]:px-5 [&_[data-actions]]:pt-3 [&_[data-actions]]:pb-(--foot) ${more.below ? "[&_[data-actions]]:border-border [&_[data-actions]]:shadow-raised" : "[&_[data-actions]]:border-transparent"}`}
                >
                  <span
                    ref={top}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  />
                  {typeof children === "function"
                    ? children({ close })
                    : children}
                  <span
                    ref={end}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
                  />
                </div>
              </div>
            </>
          )}
        </AriaDialog>
      </Modal>
    </Overlay>
  );
}

// whether the dialog's body runs on above or below what's in view, from a
// marker at each end of it (an IntersectionObserver, so content that grows
// or loads without a scroll counts too)
function useMoreOutOfView() {
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [top, setTop] = useState<HTMLElement | null>(null);
  const [end, setEnd] = useState<HTMLElement | null>(null);
  const [more, setMore] = useState({ above: false, below: false });
  useEffect(() => {
    if (!body || !top || !end) return;
    const watch = new IntersectionObserver(
      (entries) =>
        setMore((was) => {
          const now = { ...was };
          for (const entry of entries) {
            now[entry.target === top ? "above" : "below"] =
              !entry.isIntersecting;
          }
          return now;
        }),
      { root: body },
    );
    watch.observe(top);
    watch.observe(end);
    return () => watch.disconnect();
  }, [body, top, end]);
  return { body: setBody, top: setTop, end: setEnd, more };
}
