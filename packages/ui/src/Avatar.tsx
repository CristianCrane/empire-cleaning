import { useState } from "react";
import { UserRound } from "lucide-react";
import { tv } from "./utils.ts";

const avatar = tv({
  base: "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-subtle text-neutral-strong",
  variants: {
    size: { md: "size-10", lg: "size-16" },
  },
  defaultVariants: { size: "md" },
});

// A person's picture, such as their Google profile photo, or a plain person
// icon when there's none or it won't load. Decorative: put the person's name
// beside it, as it adds nothing for screen readers.
export function Avatar({
  src,
  size,
}: {
  src?: string | null;
  size?: "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span aria-hidden className={avatar({ size })}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          // Google's photo servers refuse requests that carry a referrer
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <UserRound size={size === "lg" ? 32 : 22} />
      )}
    </span>
  );
}
