import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import type { JobsTab } from "@empire-cleaning/models";
import {
  Button,
  Cell,
  Column,
  Heading,
  Row,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableHeader,
  Tabs,
  TextField,
} from "@empire-cleaning/ui";
import { clientName, formatDateTime } from "../format.ts";
import { AssignmentBadge } from "./JobScreen.tsx";

// the list's Tabs, Upcoming first: the Jobs still to do
export const jobTabs = ["upcoming", "past", "cancelled", "all"] as const;
export type JobTab = (typeof jobTabs)[number];

const tabLabel: Record<JobTab, string> = {
  upcoming: "Upcoming",
  past: "Past",
  cancelled: "Cancelled",
  all: "All",
};

// what a Tab holds, for when it's empty
const noneIn: Record<JobsTab, string> = {
  upcoming: "No Jobs booked.",
  past: "No Jobs done yet.",
  cancelled: "No Jobs cancelled.",
};

// a page of the list, and how many more Show more adds
export const JOBS_PAGE = 50;

// tab: as picked; shown: how many Show more has brought up to
export type JobsSearch = { q?: string; tab?: JobTab; shown?: number };

// the Tab unless one is picked: Upcoming, or All while searching, since the
// Job someone is looking for may be any of them
export const jobsTabFor = ({ q, tab }: JobsSearch): JobTab =>
  tab ?? (q ? "all" : "upcoming");

// how long typing pauses before the list follows it
const SEARCH_DELAY_MS = 250;

// The Office's Jobs as a Table (#96), a Tab per where they stand with its
// count: Upcoming (booked, soonest first), then Past (Completed or No
// Access) and Cancelled (Skipped too), newest first, and All. A search by
// the Client or the address looks through All, or the Tab picked. A Tab
// holds 50 at a time and Show more adds 50, so it stays quick however many
// Jobs there are. The search, Tab and how many are shown live in the URL,
// so coming Back from a Job keeps them.
export function JobsScreen() {
  const { jobs, counts } = useLoaderData({ from: "/office/jobs" });
  const search = useSearch({ from: "/office/jobs" });
  const { q = "", shown = JOBS_PAGE } = search;
  const tab = jobsTabFor(search);
  const navigate = useNavigate({ from: "/office/jobs" });
  const [text, setText] = useState(q);

  // the list follows the box once typing pauses
  useEffect(() => {
    const wanted = text.trim();
    if (wanted === q) return;
    const timer = setTimeout(
      () =>
        void navigate({
          to: "/office/jobs",
          search: (prev) => ({
            ...prev,
            q: wanted || undefined,
            shown: undefined,
          }),
          replace: true,
        }),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [text, q, navigate]);

  // and the box follows the URL, e.g. the nav's Jobs link clearing it
  useEffect(() => {
    setText((current) => (current.trim() === q ? current : q));
  }, [q]);

  const table = (
    <Table
      aria-label="Jobs"
      onRowAction={(id) =>
        void navigate({
          to: "/office/jobs/$jobId",
          params: { jobId: String(id) },
        })
      }
    >
      <TableHeader>
        <Column id="when" isRowHeader>
          When
        </Column>
        {/* on a phone, the Client, home and Service sit under the time */}
        <Column id="client" className="hidden md:table-cell">
          Client
        </Column>
        <Column id="home" className="hidden md:table-cell">
          Home
        </Column>
        <Column id="service" className="hidden lg:table-cell">
          Service
        </Column>
        <Column id="status">Status</Column>
      </TableHeader>
      <TableBody
        items={jobs}
        renderEmptyState={() => (
          <p className="p-6 text-center text-fg-muted">
            {q
              ? `No Jobs match “${q}”.`
              : tab === "all"
                ? "No Jobs yet."
                : noneIn[tab]}
          </p>
        )}
      >
        {(job) => (
          <Row id={job.id} className="cursor-pointer">
            <Cell>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold whitespace-nowrap">
                  {formatDateTime(job.startsAt)}
                </span>
                <span className="text-sm text-fg-muted md:hidden">
                  {clientName(job.client)} · {job.property.street}
                </span>
              </span>
            </Cell>
            <Cell className="hidden md:table-cell">
              {clientName(job.client)}
            </Cell>
            <Cell className="hidden md:table-cell">
              {[job.property.street, job.property.unit]
                .filter(Boolean)
                .join(", ")}
            </Cell>
            <Cell className="hidden lg:table-cell">{job.serviceName}</Cell>
            <Cell>
              <AssignmentBadge job={job} />
            </Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="flex flex-col gap-6">
      <Heading level={1}>Jobs</Heading>
      <TextField
        label="Search Jobs"
        type="search"
        placeholder="Client or address"
        value={text}
        onChange={setText}
        autoFocus
      />
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) =>
          void navigate({
            to: "/office/jobs",
            search: (prev) => ({
              ...prev,
              // as it is unless it's what the search would pick anyway
              tab:
                key === jobsTabFor({ q: prev.q }) ? undefined : (key as JobTab),
              shown: undefined,
            }),
            replace: true,
          })
        }
      >
        <TabList aria-label="Where they stand">
          {jobTabs.map((t) => (
            <Tab key={t} id={t} count={counts[t]}>
              {tabLabel[t]}
            </Tab>
          ))}
        </TabList>
        {jobTabs.map((t) => (
          <TabPanel key={t} id={t}>
            <div className="flex flex-col gap-4">
              {table}
              {jobs.length < counts[tab] && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-fg-muted">
                    Showing {jobs.length} of {counts[tab]}
                  </p>
                  <Button
                    variant="secondary"
                    onPress={() =>
                      void navigate({
                        to: "/office/jobs",
                        search: (prev) => ({
                          ...prev,
                          shown: shown + JOBS_PAGE,
                        }),
                        replace: true,
                        resetScroll: false,
                      })
                    }
                  >
                    Show more
                  </Button>
                </div>
              )}
            </div>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
