import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type { OpenPlace } from "@empire-cleaning/models";
import { CalendarClock, Clock, MapPin, Users } from "lucide-react";
import {
  ActionRow,
  Breadcrumbs,
  Button,
  Card,
  Heading,
  IconTile,
  Notice,
  Section,
  StatusBadge,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { Fact } from "../Fact.tsx";
import {
  dayOfInstant,
  formatDateTime,
  formatDay,
  formatHours,
  formatTime,
} from "../format.ts";
import { untilAbout } from "./CleanerHome.tsx";

// "Just you", "2 Cleaners"
export const crewOf = (place: Pick<OpenPlace, "crewSize">) =>
  place.crewSize === 1 ? "Just you" : `${place.crewSize} Cleaners`;

// An Open Place as a Cleaner it's open to sees it (ADR-0019): what, when,
// for how long and roughly where. They Confirm it, first come first served,
// or say it's not for them. The address, Access Instructions and Client
// come once they've taken it.
export function OpenPlaceScreen() {
  const place = useLoaderData({ from: "/cleaner/open/$jobId" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Offers", href: linkTo({ to: "/cleaner/offers" }) },
            { label: formatDateTime(place.startsAt) },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{place.serviceName}</Heading>
          <StatusBadge tone="info">Open</StatusBadge>
        </div>
      </div>

      <TakeIt place={place} />

      <Section title="Job details">
        <Card>
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <IconTile icon={CalendarClock} size="lg" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm text-fg-muted">
                  {formatDay(dayOfInstant(place.startsAt))},{" "}
                  {untilAbout(place.startsAt, place.hoursOnSite)}
                </p>
                <p className="text-3xl font-semibold text-fg tabular-nums">
                  {formatTime(place.startsAt)}
                </p>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              <Fact
                icon={Clock}
                label="On site"
                value={`About ${formatHours(place.hoursOnSite)}`}
              />
              <Fact icon={Users} label="Crew" value={crewOf(place)} />
              <Fact
                icon={MapPin}
                label="Area"
                value={place.postcode}
                line="Area: the address shows once it's yours"
              />
            </dl>
          </div>
        </Card>
      </Section>
    </div>
  );
}

function TakeIt({ place }: { place: OpenPlace }) {
  const navigate = useNavigate();
  const [problem, setProblem] = useState<string>();
  const [pending, setPending] = useState<"confirm" | "pass">();

  // neither reloads this page: once taken or passed, it isn't open to them
  const answer = async (which: "confirm" | "pass") => {
    setPending(which);
    setProblem(undefined);
    try {
      await postJson(`/api/assignments/open/${place.jobId}/${which}`);
      if (which === "confirm") {
        showToast({ tone: "success", title: "Place confirmed" });
        await navigate({
          to: "/cleaner/jobs/$jobId",
          params: { jobId: place.jobId },
        });
      } else {
        showToast({ tone: "success", title: "Taken off your list" });
        await navigate({ to: "/cleaner/offers" });
      }
    } catch (e) {
      setProblem(
        e instanceof ApiError && e.status === 409
          ? e.message
          : "That didn't work. Please try again.",
      );
    } finally {
      setPending(undefined);
    }
  };

  return (
    <Section title="Can you take it?">
      <Card>
        {problem && <Notice tone="danger">{problem}</Notice>}
        <ActionRow
          actions={
            <>
              <Button
                variant="secondary"
                isPending={pending === "pass"}
                isDisabled={pending === "confirm"}
                onPress={() => void answer("pass")}
              >
                Not for me
              </Button>
              <Button
                isPending={pending === "confirm"}
                isDisabled={pending === "pass"}
                onPress={() => void answer("confirm")}
              >
                Confirm
              </Button>
            </>
          }
        >
          <p>
            It has a place open, and you're free then. The first Cleaner to
            confirm takes it, and sees the address, how to get in and the
            Client.
          </p>
        </ActionRow>
      </Card>
    </Section>
  );
}
