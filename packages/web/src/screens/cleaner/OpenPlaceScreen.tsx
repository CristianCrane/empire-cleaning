import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type { OpenPlace } from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Heading,
  Notice,
  StatusBadge,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { formatDateTime, formatHours } from "../format.ts";

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
            { label: "Your Jobs", href: linkTo({ to: "/cleaner" }) },
            { label: formatDateTime(place.startsAt) },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{formatDateTime(place.startsAt)}</Heading>
          <StatusBadge tone="info">Open</StatusBadge>
        </div>
      </div>

      <TakeIt place={place} />

      <Card title="The clean">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Clean</dt>
          <dd>{place.serviceName}</dd>
          <dt className="font-semibold">Time on site</dt>
          <dd>About {formatHours(place.hoursOnSite)}</dd>
          <dt className="font-semibold">Crew</dt>
          <dd>{crewOf(place)}</dd>
          <dt className="font-semibold">Area</dt>
          <dd>{place.postcode}</dd>
        </dl>
      </Card>
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
        await navigate({ to: "/cleaner" });
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
    <Card title="Can you take it?">
      <p>
        This Job has a place open, and you're free then. The first Cleaner to
        confirm takes it. You'll see the address, Access Instructions and the
        Client once you have.
      </p>
      {problem && <Notice tone="danger">{problem}</Notice>}
      <Actions>
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
      </Actions>
    </Card>
  );
}
