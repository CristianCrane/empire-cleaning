import type { ReactNode } from "react";
import {
  Dialog as AriaDialog,
  Menu as AriaMenu,
  Modal,
} from "react-aria-components";
import { Button } from "./Button.tsx";
import { useUiWords } from "./language.ts";
import { Overlay } from "./Overlay.tsx";

// A phone's choices, rising from the foot of the screen at its width: a
// large row for each (MenuItems, `large`), the destructive last after a
// MenuSeparator, and Cancel apart at the foot. It's a menu, not a form, so
// it has no title or ✕, as a Dialog's sheet has. Opened in a DialogTrigger
// after the Button that opens it, and named `label`, as that Button is; a
// choice closes it, so a dialog the choice opens is the only one
export function ActionSheet({
  label,
  children,
}: {
  label: string;
  // its MenuItems, each `large`
  children: ReactNode;
}) {
  const words = useUiWords();
  return (
    <Overlay isDismissable className="flex items-end">
      <Modal className="w-full rounded-t-xl bg-overlay text-fg shadow-overlay entering:animate-in entering:slide-in-from-bottom-8 exiting:animate-out exiting:slide-out-to-bottom-8">
        <AriaDialog
          aria-label={label}
          className="flex flex-col pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] outline-none"
        >
          {({ close }) => (
            <>
              <AriaMenu
                aria-label={label}
                onAction={close}
                className="flex flex-col px-2 outline-none"
              >
                {children}
              </AriaMenu>
              <div className="mt-2 border-t border-border px-4 pt-3">
                <Button variant="secondary" onPress={close} className="w-full">
                  {words.cancel}
                </Button>
              </div>
            </>
          )}
        </AriaDialog>
      </Modal>
    </Overlay>
  );
}
