import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import {
  Avatar,
  Heading,
  List,
  ListItem,
  TextField,
} from "@empire-cleaning/ui";
import { clientName } from "../format.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { ClientsList, variants } from "./clients-list.prototype.tsx";

// PROTOTYPE: variant picks a list layout (#96)
export type ClientsSearch = { q?: string; variant?: string };

// how long typing pauses before the list follows it
const SEARCH_DELAY_MS = 250;

// every Client, searchable by name, email, phone or Property address; open
// one to see their contact details and homes. The search lives in the URL,
// so coming Back from a Client keeps it.
export function ClientsScreen() {
  const clients = useLoaderData({ from: "/office/clients" });
  const { q = "", variant = "A" } = useSearch({ from: "/office/clients" });
  const navigate = useNavigate();
  const [text, setText] = useState(q);

  // the list follows the box once typing pauses
  useEffect(() => {
    const wanted = text.trim();
    if (wanted === q) return;
    const timer = setTimeout(
      () =>
        void navigate({
          to: "/office/clients",
          search: (prev) => ({ ...prev, q: wanted || undefined }),
          replace: true,
        }),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [text, q, navigate]);

  // and the box follows the URL, e.g. the nav's Clients link clearing it
  useEffect(() => {
    setText((current) => (current.trim() === q ? current : q));
  }, [q]);

  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Clients</Heading>
      <TextField
        label="Search Clients"
        type="search"
        placeholder="Name, email, phone or address"
        value={text}
        onChange={setText}
        autoFocus
      />
      {/* PROTOTYPE: the list's layouts, flipped with ?variant= (#96) */}
      <ClientsList variant={variant} real={clients} q={q} />
      <PrototypeSwitcher
        variants={variants}
        current={variant}
        onChange={(key) =>
          void navigate({
            to: "/office/clients",
            search: (prev) => ({ ...prev, variant: key }),
            replace: true,
          })
        }
      />
    </div>
  );
}
