import { Fragment, useState, type ReactNode } from "react";
import { Fold } from "../Fold.tsx";
import { useUiWords } from "../language.ts";
import { List, ListItem } from "../List.tsx";
import { Section } from "../Section.tsx";
import { Alerts, type Alert } from "./Alerts.tsx";
import { listRowItem, type ListRow } from "./ListPage.tsx";
import type { DialogState } from "../Dialog.tsx";
import { PageHeader } from "./PageHeader.tsx";

// One part of a Settings page read as one row: what it's set to, in a line
// ("Light 0.85× · Average 1× · Heavy 1.4×"); a tap opens its dialog, where
// its figures, their explanation and what saving does are read and changed
// (given its open state, as a PageAction's is)
export type SettingsPart = {
  id: string;
  title: string;
  summary: ReactNode;
  dialog: (state: DialogState) => ReactNode;
};

// The Settings type's layout (docs/ux.md, Screen types, Settings; #436):
// how things are set up, read rather than worked through. Its PageHeader,
// the title in a phone's bar and at most one muted line (which version);
// its alerts; one card of summary rows, a part each, opening its dialog;
// then its lists of rows (SettingsList). Nothing on it explains: that's in
// each part's dialog
export function SettingsPage({
  title,
  subtitle,
  alerts = [],
  parts,
  children,
}: {
  title: string;
  subtitle?: string;
  // those that apply now, the rest false, null or undefined
  alerts?: (Alert | false | null | undefined)[];
  parts: SettingsPart[];
  // its lists of rows, each a SettingsList
  children?: ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} inBar subtitle={subtitle} />
      <Alerts alerts={alerts} />
      <List aria-label={title} onAction={(id) => setOpen(String(id))}>
        {parts.map((part) => (
          <ListItem
            key={part.id}
            id={part.id}
            title={part.title}
            description={part.summary}
          />
        ))}
      </List>
      {parts.map((part) => (
        <Fragment key={part.id}>
          {part.dialog({
            isOpen: open === part.id,
            onOpenChange: (isOpen) => setOpen(isOpen ? part.id : null),
          })}
        </Fragment>
      ))}
      {children}
    </div>
  );
}

// A Settings page's list of rows (Extras, Your homes), its Add on the
// title's line; the retired ones folded after, under "Retired (N)"
export function SettingsList({
  title,
  actions,
  rows,
  retired = [],
  empty,
}: {
  title: string;
  actions?: ReactNode;
  rows: ListRow[];
  retired?: ListRow[];
  // said with no rows
  empty?: string;
}) {
  const words = useUiWords();
  return (
    <Section title={title} actions={actions}>
      {rows.length > 0 ? (
        <List aria-label={title}>{rows.map((row) => listRowItem(row))}</List>
      ) : (
        empty && <p className="text-fg-muted">{empty}</p>
      )}
      {retired.length > 0 && (
        <Fold label={words.retired(retired.length)}>
          <List aria-label={words.retired(retired.length)}>
            {retired.map((row) => listRowItem(row))}
          </List>
        </Fold>
      )}
    </Section>
  );
}
