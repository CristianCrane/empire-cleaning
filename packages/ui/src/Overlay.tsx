import { ModalOverlay, type ModalOverlayProps } from "react-aria-components";

// The dimmed screen behind what's modal (a Dialog, the Drawer, an
// ActionSheet), fading in and out: each keeps its own rules for when a tap
// outside or Escape closes it, and lays out what it holds with `className`
export function Overlay({
  className = "",
  ...props
}: Omit<ModalOverlayProps, "className"> & { className?: string }) {
  return (
    <ModalOverlay
      {...props}
      className={`fixed inset-0 z-50 bg-backdrop entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out ${className}`}
    />
  );
}
