# Sentry alone for errors, performance, uptime and heartbeats, behind our own monitoring interface

Errors, performance traces, uptime checks and heartbeats all go to Sentry, on its free plan, with every alert sent by email to the one person running the system. The rest of the code never talks to Sentry directly: it goes through `#services/monitoring` (`error`, `signal`, `heartbeat`), with a Sentry adapter behind it and a fake in tests, just as with email, the Clock and the Payment Gateway (ADR-0004). We chose one hosted tool over adding Better Stack for uptime and phone push (a second tool, and its push alerts need a paid seat), over self-hosting Prometheus and Grafana (monitoring that would itself need monitoring, and fail along with the app), and over Datadog or New Relic (far beyond a small business's budget). Nothing here depends on the host, which was chosen later (ADR-0020).

## What's watched

- **Errors**: the API, the web app, and the landing site's Quote form. Only 5xx responses, unhandled errors and failures we catch but didn't expect count; 4xx responses (validation, sign-in, 409 conflicts such as a declined card) are normal business and appear only in the logs.
- **Performance**: about 20% of API requests and browser page loads are traced, which shows slow queries and slow calls to Stripe and Resend. One alert: the API's p95 over 1 s for 10 minutes. Releases are tagged with the git commit and source maps uploaded at build.
- **Uptime**: one monitor on the API's `/health`, which runs `select 1` with a 2 s timeout and returns 503 if the database can't answer. It doesn't check Stripe or Resend: their outages are signals, not us being down.
- **Heartbeat**: one cron monitor for the in-process scheduler as a whole, which checks in after each tick in which every due job succeeded. A stopped timer or a failing job both miss the check-in.
- **Business signals**: named, not free-form, each urgent or not, sent as Sentry events tagged with their urgency:

| Signal | Means | Urgency |
|---|---|---|
| `payment_gateway_error` | the payment provider is unreachable or erroring (not a decline) | urgent |
| `refund_failed` | money was taken, booking failed, and the refund didn't go through | urgent |
| `heartbeat_missed` | a scheduled job has stopped running | urgent |
| `email_send_failed` | the email service refused a message or was unreachable | urgent at more than 3 in 15 minutes (sign-in links stop), otherwise not |
| `charge_declined` | a Client's card was declined | counted, never alerted |

Urgent alerts carry a subject prefix and go to an address the phone treats as VIP.

## Client data

No Client's personal details go to Sentry: people are identified by Client, Staff or Account ID only. Request bodies, emails, phone numbers, addresses and Access Instructions are stripped from events, and session replay is off.

## Logs

Structured JSON from `pino` to stdout, kept by the host, with a request ID on every line that is also put on every Sentry event, and the same redaction. No log vendor until searching the host's logs proves painful.

## Consequences

- An exception to "the same variables are required in every mode": Sentry's keys are required in production only. Without them, `#services/monitoring` logs to the console and sends nothing, so development and tests never alert anyone.
- The landing site and the web app aren't uptime-checked: static files on a CDN rarely fail on their own, and the one free uptime monitor is better spent on the API. Browser errors are still reported once their JavaScript loads.
- One heartbeat for the whole scheduler means an alert says that some job stopped, not which one; the logs say which.
- Email can be missed at night. Before real Clients depend on the system, add phone push for urgent alerts. Because urgency is already a tag, that's routing, not code.
- To watch the static sites or give each job its own heartbeat, pay for more Sentry monitors (pay-as-you-go, or the Team plan).
- Sentry's free plan has one user and a monthly error allowance. Check its current limits, and whether extra monitors need a paid plan, when setting it up.
