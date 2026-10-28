// PROTOTYPE: throwaway. /office/clients/$clientId?variant=A|B|C|D.
// Question: how does a Section's action (Edit) look? Every variant leads
// with an icon; they differ in the button's style.
import type { ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { Button } from "@empire-cleaning/ui";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

const variants = [
  { key: "A", name: "secondary, outlined" },
  { key: "B", name: "quiet, no box" },
  { key: "C", name: "text link in brand colour" },
  { key: "D", name: "tonal, tinted brand" },
];

export function SectionAction({ children }: { children: ReactNode }) {
  const { variant = "A" } = useSearch({ from: "/office/clients/$clientId" });
  const icon = <Pencil aria-hidden size={variant === "A" ? 18 : 16} />;

  switch (variant) {
    case "B":
      return (
        <Button variant="quiet" size="sm">
          {icon}
          {children}
        </Button>
      );
    case "C":
      return (
        <Button
          variant="quiet"
          size="sm"
          className="px-1 text-primary hover:bg-transparent hover:underline pressed:bg-transparent"
        >
          {icon}
          {children}
        </Button>
      );
    case "D":
      return (
        <Button
          variant="quiet"
          size="sm"
          className="bg-primary/10 text-primary hover:bg-primary/20 pressed:bg-primary/20"
        >
          {icon}
          {children}
        </Button>
      );
    default:
      return (
        <Button variant="secondary">
          {icon}
          {children}
        </Button>
      );
  }
}

export function SectionActionsSwitcher() {
  const { variant = "A" } = useSearch({ from: "/office/clients/$clientId" });
  const navigate = useNavigate({ from: "/office/clients/$clientId" });
  return (
    <PrototypeSwitcher
      variants={variants}
      current={variant}
      onChange={(key) =>
        void navigate({ search: { variant: key }, replace: true })
      }
    />
  );
}
