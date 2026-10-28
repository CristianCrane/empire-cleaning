import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@empire-cleaning/ui";

// an optional field, tucked behind a "+ Add …" link until it's wanted, so the
// form shows only what it needs (#96). Shown from the start when it already
// has something in it or a message from the API.
export function Optional({
  add,
  shown,
  children,
}: {
  // what the link says, e.g. "Add a note"
  add: string;
  shown: boolean;
  children: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // opened by hand: the field is what they want next
  useEffect(() => {
    if (opened)
      box.current?.querySelector<HTMLElement>("input, textarea")?.focus();
  }, [opened]);

  if (!opened && !shown) {
    return (
      <Button
        variant="quiet"
        size="sm"
        className="-mx-3 self-start text-primary"
        onPress={() => setOpened(true)}
      >
        + {add}
      </Button>
    );
  }
  return (
    <div ref={box} className="contents">
      {children}
    </div>
  );
}
