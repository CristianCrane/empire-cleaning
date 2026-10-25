import { useId, type ReactNode } from "react";
import { fieldStyles } from "./Field.tsx";

// A field whose input belongs to someone else, such as a payment provider's
// card box in its own frame: it looks like our other fields and carries their
// label, explanation and error, while the input inside is theirs. Tell it
// when that input has focus or is invalid, as only its owner knows.
export function EmbeddedField({
  label,
  description,
  errorMessage,
  isFocused = false,
  children,
}: {
  label: string;
  description?: string;
  errorMessage?: string;
  isFocused?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1">
      <span id={id} className="text-sm font-semibold text-fg">
        {label}
      </span>
      {description && (
        <span className="text-sm text-fg-muted">{description}</span>
      )}
      <div
        className={fieldStyles({
          isFocused,
          isInvalid: Boolean(errorMessage),
          className: "flex items-center py-3",
        })}
      >
        <div className="w-full">{children}</div>
      </div>
      {errorMessage && (
        <span className="text-sm font-medium text-danger-strong">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
