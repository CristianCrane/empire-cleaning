import {
  Dialog as AriaDialog,
  Modal,
  ModalOverlay,
  type ModalOverlayProps,
} from "react-aria-components";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useUiWords } from "./language.ts";
import { Button } from "./Button.tsx";

export type DrawerProps = {
  // what a screen reader announces, as the drawer has no visible title
  "aria-label": string;
  children: ReactNode | ((opts: { close: () => void }) => ReactNode);
  isOpen?: ModalOverlayProps["isOpen"];
  onOpenChange?: ModalOverlayProps["onOpenChange"];
  // something pressed in it is under way (switching area): it stays open,
  // as a busy Dialog does, until that's done
  isBusy?: boolean;
};

// a panel sliding in from the left over the page, for a phone's menu. Use
// inside a DialogTrigger after the Button that opens it. Tapping outside or
// the ✕ closes it.
export function Drawer({
  children,
  isOpen,
  onOpenChange,
  isBusy = false,
  ...props
}: DrawerProps) {
  const words = useUiWords();
  return (
    <ModalOverlay
      isDismissable={!isBusy}
      isKeyboardDismissDisabled={isBusy}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="fixed inset-0 z-50 bg-backdrop entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out"
    >
      <Modal className="fixed inset-y-0 left-0 w-72 max-w-[85vw] overflow-auto bg-surface text-fg shadow-overlay entering:animate-in entering:slide-in-from-left exiting:animate-out exiting:slide-out-to-left">
        <AriaDialog
          aria-label={props["aria-label"]}
          className="relative flex min-h-full flex-col gap-6 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] outline-none"
        >
          {({ close }) => (
            <>
              <Button
                variant="quiet"
                size="icon"
                aria-label={words.close}
                isDisabled={isBusy}
                onPress={close}
                className="absolute top-2 right-2"
              >
                <X aria-hidden size={20} />
              </Button>
              {typeof children === "function" ? children({ close }) : children}
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
