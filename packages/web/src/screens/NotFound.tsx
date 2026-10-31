import { SearchX } from "lucide-react";
import { MessagePage } from "./MessagePage.tsx";

// also what a record that isn't the person's shows: we don't say it exists
export function NotFound() {
  return (
    <MessagePage title="Page not found" icon={SearchX}>
      <p className="text-fg-muted">That page doesn't exist.</p>
    </MessagePage>
  );
}
