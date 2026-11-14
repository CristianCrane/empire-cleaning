import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import type { SortDescriptor } from "react-aria-components";
import { Search, type LucideIcon } from "lucide-react";
import { dayOf, formats, type Language } from "@empire-cleaning/models";
import { Button } from "../Button.tsx";
import { DateTile } from "../DateTile.tsx";
import { EmptyState } from "../EmptyState.tsx";
import { Heading } from "../Heading.tsx";
import { useLanguage, useUiWords } from "../language.ts";
import { List, ListItem } from "../List.tsx";
import { useSettled } from "../settled.ts";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "../Table.tsx";
import { Tab, TabList, TabPanel, Tabs } from "../Tabs.tsx";
import { TextField } from "../TextField.tsx";
import { useWide } from "../wide.ts";
import { ActionButton, PageHeader, type PageAction } from "./PageHeader.tsx";

// a page of a list, and how many more Show more adds
export const LIST_PAGE = 50;

// one Tab: what it's called, how many it holds, and the line it shows when
// it holds none ("No jobs booked.")
export type ListTab = {
  id: string;
  label: string;
  count: number;
  none: string;
};

// One row of a list. `at` makes it a dated row (DatedItem): by month, a
// DateTile leading it, its title the weekday and time, then `title`, what
// the person looking tells it apart by (the Office: the Client; a Cleaner:
// the area; a Client: the kind of clean)
export type ListRow = {
  id: string;
  at?: string;
  title: string;
  description?: ReactNode;
  // what leads an undated row, e.g. an Avatar
  start?: ReactNode;
  // where it stands: shown when it isn't `plain` in its Tab (Needs
  // cleaners, not Staffed), and on every row while a search spans the Tabs
  status?: { badge: ReactNode; plain: boolean };
  // what else isn't usual about it, always shown (Needs a site visit)
  badges?: ReactNode;
  // what opening it does; without, it opens nothing
  onOpen?: () => void;
};

// a column of an Office list's Table: its header, its cell, and whether
// it shows from lg only. The first is the row's name; the layout adds the
// Status column, from the rows' badges
export type ListColumn<T> = {
  id: string;
  label: string;
  from?: "lg";
  allowsSorting?: boolean;
  cell: (item: T) => ReactNode;
};

// an Office work list's search: it looks through every Tab, and says how
// many it found
export type ListSearch = {
  label: string;
  placeholder: string;
  // what's searched for now (the URL's), "" for nothing
  query: string;
  // the box's words, once typing pauses
  onSearch: (query: string) => void;
  found: number;
};

// The List type's layout (docs/ux.md, Screen types, List; #433): every one
// of something, to find one and open it.
// - Its PageHeader: the title, in a phone's top bar, and at most one
//   primary, for making a new one.
// - Its Tabs, the one way it splits, each with its count.
// - A search, at the end of the Tabs' line from md and behind an icon on a
//   phone, that looks through every Tab while the Tabs step aside.
// - Its rows: a Table from md when it has columns (an Office list), by
//   month when they're dated, 50 at a time, then Show more.
// - With nothing in it at all, its empty state: the primary, moved there
//   from the header, when it has one, else one quiet line.
export function ListPage<T>({
  title,
  primary,
  tabs,
  tab,
  onTabChange,
  search,
  items,
  row,
  columns,
  sort,
  more,
  empty,
}: {
  title: string;
  primary?: PageAction;
  tabs: ListTab[];
  tab: string;
  onTabChange: (tab: string) => void;
  search?: ListSearch;
  // the Tab's, or while searching, every match, in order: when `more`
  // pages them, those shown; else every one, and the layout pages them
  items: T[];
  row: (item: T) => ListRow;
  columns?: ListColumn<T>[];
  // the Table's sorting, from md (Quotes'): the screen sorts `items`
  sort?: {
    descriptor: SortDescriptor;
    onChange: (descriptor: SortDescriptor) => void;
  };
  // paged by the server: how many more there are, and how to show them
  more?: { left: number; onMore: () => void };
  // nothing in it at all, in any Tab: what's missing ("No quotes yet")
  empty: { icon: LucideIcon; title: string };
}) {
  const words = useUiWords();
  const wide = useWide();
  const [text, setText] = useSearchText(search);
  const [opened, setOpened] = useState(false);
  const searching = !!search?.query;
  const nothing = !searching && tabs.every((t) => t.count === 0);

  // kept where it is as a search starts, so typing goes on in it
  const field = search && (
    <TextField
      label={search.label}
      type="search"
      placeholder={search.placeholder}
      value={text}
      onChange={setText}
      autoFocus={!wide && opened}
      className={wide ? "w-72 [&_label]:sr-only" : undefined}
    />
  );
  const clear = () => {
    setText("");
    setOpened(false);
    search?.onSearch("");
  };
  const body = (none: string | null) => (
    <ListBody
      key={`${tab} ${search?.query ?? ""}`}
      label={title}
      items={items}
      row={row}
      columns={wide ? columns : undefined}
      sort={sort}
      more={more}
      searching={searching}
      none={none}
    />
  );

  let list: ReactNode;
  if (nothing)
    list = primary ? (
      <EmptyState icon={empty.icon} title={empty.title}>
        <ActionButton action={primary} variant="primary" />
      </EmptyState>
    ) : (
      <p className="text-fg-muted">{empty.title}</p>
    );
  else
    list = (
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => onTabChange(String(key))}
      >
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            {searching ? (
              <p className="py-2 font-semibold" role="status">
                {search.found > 0
                  ? words.found(search.found)
                  : words.noMatch(search.query)}
              </p>
            ) : (
              <TabList aria-label={title}>
                {tabs.map((t) => (
                  <Tab key={t.id} id={t.id} count={t.count}>
                    {t.label}
                  </Tab>
                ))}
              </TabList>
            )}
          </div>
          {wide && field}
          {searching && (
            <Button variant="text" onPress={clear}>
              {words.clearSearch}
            </Button>
          )}
        </div>
        {!searching &&
          tabs.map((t) => (
            <TabPanel key={t.id} id={t.id}>
              {body(t.none)}
            </TabPanel>
          ))}
      </Tabs>
    );
  // a search's matches outside the Tabs, which would take a Table's
  // columns for their own collection
  const found = searching && search.found > 0 && body(null);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        inBar
        // with nothing in it, the empty state holds it instead
        primary={nothing ? undefined : primary}
        tools={
          search &&
          !wide &&
          !nothing && (
            <Button
              variant="quiet"
              size="icon"
              aria-label={search.label}
              aria-expanded={opened || searching}
              onPress={() => setOpened((o) => !o)}
            >
              <Search aria-hidden size={20} />
            </Button>
          )
        }
      />
      {!wide && (opened || searching) && field}
      {list}
      {found}
    </div>
  );
}

// The search box's words: the URL's search to start, the URL told once
// typing pauses, and the box told when the URL changes by other means
// (Back, the nav's link clearing it)
function useSearchText(search: ListSearch | undefined) {
  const query = search?.query ?? "";
  const [text, setText] = useState(query);
  const settled = useSettled(text);
  // the URL as it is now: a Back leaves `settled` on the old words until
  // the box's pause ends, and they mustn't undo it
  const tell = useEffectEvent((wanted: string) => {
    if (wanted !== query) search?.onSearch(wanted);
  });

  useEffect(() => tell(settled), [settled]);

  useEffect(() => {
    setText((current) => (current.trim() === query ? current : query));
  }, [query]);

  return [text, setText] as const;
}

// things in the order given, by the month each is in, in New York, as a
// reader of `lang` names it: a dated list's, a statement's
export function byMonth<X>(lang: Language, items: X[], at: (x: X) => string) {
  const { formatMonth } = formats[lang];
  const months: { month: string; items: X[] }[] = [];
  for (const x of items) {
    const month = formatMonth(dayOf(new Date(at(x))));
    if (months.at(-1)?.month !== month) months.push({ month, items: [] });
    months.at(-1)!.items.push(x);
  }
  return months;
}

// A dated row (docs/ux.md, "Dated things a person scans are grouped by
// month"): a small DateTile, then the weekday and time, then `title`, what
// the person looking tells it apart by. The tile is decorative, so its date
// is said to a screen reader before the time
export function DatedItem({
  id,
  at,
  title,
  description,
  end,
  onAction,
}: {
  id: string;
  at: string;
  title: string;
  description?: ReactNode;
  end?: ReactNode;
  onAction?: () => void;
}) {
  const { dateTile, formatDate, formatDateTime, formatTime } =
    formats[useLanguage()];
  return (
    <ListItem
      id={id}
      textValue={`${formatDateTime(at)} · ${title}`}
      heard={formatDate(at)}
      title={`${dateTile(at).weekday} ${formatTime(at)} · ${title}`}
      start={<DateTile date={at} size="sm" />}
      description={description}
      end={end}
      onAction={onAction}
    />
  );
}

// what a row shows of where it stands: its status unless that's plain in
// its Tab (always while searching), and whatever else isn't usual
function badgesOf(row: ListRow, searching: boolean) {
  const status = row.status && (searching || !row.status.plain);
  if (!status && !row.badges) return undefined;
  return (
    <span className="flex flex-wrap gap-1">
      {status && row.status!.badge}
      {row.badges}
    </span>
  );
}

// the Status column, the layout's own
const STATUS = "status";

function ListBody<T>({
  label,
  items,
  row,
  columns,
  sort,
  more,
  searching,
  none,
}: {
  label: string;
  items: T[];
  row: (item: T) => ListRow;
  // given from md only
  columns: ListColumn<T>[] | undefined;
  sort?: {
    descriptor: SortDescriptor;
    onChange: (descriptor: SortDescriptor) => void;
  };
  more?: { left: number; onMore: () => void };
  searching: boolean;
  none: string | null;
}) {
  const words = useUiWords();
  const lang = useLanguage();
  const [shown, setShown] = useState(LIST_PAGE);
  const page = more ? items : items.slice(0, shown);
  const left = more ? more.left : items.length - page.length;
  const rows = page.map((item) => ({ item, row: row(item) }));
  if (rows.length === 0)
    return none && <p className="p-6 text-center text-fg-muted">{none}</p>;
  // a dated list by month, at every width
  const months = rows.every((r) => r.row.at)
    ? byMonth(lang, rows, (r) => r.row.at!)
    : null;
  const named = (month: string) => `${label}, ${month}`;

  let list: ReactNode;
  if (columns) {
    // the Status column only while a row has something to say in it
    const status = rows.some((r) => badgesOf(r.row, searching));
    const lg = (c: { from?: "lg" }) =>
      c.from === "lg" ? "hidden lg:table-cell" : undefined;
    const table = (name: string, rs: typeof rows) => (
      <Table
        aria-label={name}
        // a month's Table lines up with the next one's
        className={months ? "table-fixed" : undefined}
        sortDescriptor={sort?.descriptor}
        onSortChange={sort?.onChange}
      >
        <TableHeader>
          {columns.map((c, i) => (
            <Column
              key={c.id}
              id={c.id}
              isRowHeader={i === 0}
              allowsSorting={!!sort && c.allowsSorting}
              className={lg(c)}
            >
              {c.label}
            </Column>
          ))}
          {status && (
            <Column id={STATUS} allowsSorting={!!sort}>
              Status
            </Column>
          )}
        </TableHeader>
        <TableBody>
          {rs.map(({ item, row: r }) => (
            <Row key={r.id} id={r.id} onAction={r.onOpen}>
              {columns.map((c, i) => (
                <Cell key={c.id} className={lg(c)}>
                  {i === 0 ? (
                    <span className="font-semibold">{c.cell(item)}</span>
                  ) : (
                    c.cell(item)
                  )}
                </Cell>
              ))}
              {status && <Cell>{badgesOf(r, searching)}</Cell>}
            </Row>
          ))}
        </TableBody>
      </Table>
    );
    list = months
      ? months.map(({ month, items: rs }) => (
          <Month key={month} month={month}>
            {table(named(month), rs)}
          </Month>
        ))
      : table(label, rows);
  } else {
    const item = ({ row: r }: (typeof rows)[number]) =>
      r.at ? (
        <DatedItem
          key={r.id}
          id={r.id}
          at={r.at}
          title={r.title}
          description={r.description}
          end={badgesOf(r, searching)}
          onAction={r.onOpen}
        />
      ) : (
        <ListItem
          key={r.id}
          id={r.id}
          title={r.title}
          description={r.description}
          start={r.start}
          end={badgesOf(r, searching)}
          onAction={r.onOpen}
        />
      );
    list = months ? (
      months.map(({ month, items: rs }) => (
        <Month key={month} month={month}>
          <List aria-label={named(month)}>{rs.map(item)}</List>
        </Month>
      ))
    ) : (
      <List aria-label={label}>{rows.map(item)}</List>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {list}
      {left > 0 && (
        <Button
          variant="secondary"
          className="self-center"
          onPress={more ? more.onMore : () => setShown((n) => n + LIST_PAGE)}
        >
          {words.showMoreLeft(formats[lang].formatNumber(left))}
        </Button>
      )}
    </div>
  );
}

// a month of a dated list, under its name
function Month({ month, children }: { month: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <Heading level={2} size={4} className="text-fg-muted">
        {month}
      </Heading>
      {children}
    </section>
  );
}
