import { expect, test } from "vitest";
import { filledDaysOf, quotes } from "./quotes.ts";

// a cleaning plan's quote over two days, and a one-off's single time
const twoDays = { days: [{}, {}] };
const oneDay = { days: [{}] };

test("a quote whose time filled names what filled: a clean's time, a plan's days, a change's new days (#534)", () => {
  expect(filledDaysOf({ plan: null, changes: false })).toBe("clean");
  // one day is its time, plan or not
  expect(filledDaysOf({ plan: oneDay, changes: true })).toBe("clean");
  expect(filledDaysOf({ plan: twoDays, changes: false })).toBe("plan");
  expect(filledDaysOf({ plan: twoDays, changes: true })).toBe("change");

  const when = "Mon, Jan 12, 9:00 AM";
  expect(quotes.en.bookedUp("clean", when)).toBe(
    "Sorry, Mon, Jan 12, 9:00 AM has been fully booked since we sent this quote, so it can't be accepted.",
  );
  expect(quotes.en.bookedUp("plan", when)).toBe(
    "Sorry, one of the days your plan starts on has been fully booked since we sent this quote, so it can't be accepted.",
  );
  // the plan they have stays: "starts on" isn't what happened
  expect(quotes.en.bookedUp("change", when)).toBe(
    "Sorry, one of the new days for your plan has been fully booked since we sent this quote, so it can't be accepted.",
  );
  expect(quotes.es.bookedUp("change", when)).toBe(
    "Lo sentimos, uno de los nuevos días de su plan se llenó después de que le enviamos esta cotización, así que no se puede aceptar.",
  );
});
