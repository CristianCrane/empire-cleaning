# Sentry alone for errors, performance, uptime and heartbeats, behind our own monitoring interface

Errors, traces, measures, uptime and heartbeats go to Sentry, on its free plan, every alert emailed to the one person running it. The code reaches Sentry only through `#services/monitoring` (`error`, `signal`, `measure`, `heartbeat`), a Sentry adapter behind it and a fake in tests, as with email, the Clock and the Payment Gateway (ADR-0004). We chose one hosted tool over adding Better Stack for uptime and phone push (a second tool, whose push alerts need a paid seat), over self-hosting Prometheus and Grafana (monitoring that would itself need monitoring, and fail along with the app), and over Datadog or New Relic (far beyond our budget).

## What's watched

- **Errors**: in the API, the web app and the landing site's Quote form, only 5xx responses, unhandled errors and failures we catch but didn't expect count; 4xx responses are normal business and only logged. A browser error with no frame from our own builds is dropped.
- **Performance**: about 20% of API requests and page loads are traced, with one alert: the API's p95 over 1 s for 10 minutes. Releases are tagged with the commit, and source maps uploaded at build.
- **Measures**: each database pool's gauges (in use, idle, waiting, longest wait), every 10 s. One Metric Monitor per pool alerts when `db.pool.waiting`'s minimum stays above 0 for 5 minutes: requests queued the whole time. We chose gauges over spans (only 20% are traced and spans carry no counts, so a short run dry can be missed) and over a periodic log line (nothing alerts on Render's logs).
- **Uptime**: one monitor on the API's `/health`, at the server's own address, as the app's domain forwards only `/api/*`. It runs `select 1` and returns 503 if the database can't answer. It leaves out Stripe and Resend, whose outages are signals.
- **Heartbeat**: one cron monitor for the whole scheduler, checked in after each tick whose due jobs succeeded.
- **Business signals**: named, never free-form, each urgent, in bulk or counted, listed in `SIGNALS` (`services/monitoring/signals.ts`). A counted one is a Sentry counter, never an event, so it opens no issue and no email calls it an error.

Urgent alerts come from rules and monitors named `URGENT: …`, as Sentry's email subject can't carry the urgency, and a Gmail filter matches "URGENT" from Sentry's sender. Every rule and monitor watches the `test` environment until go-live.

## Client data and logs

Sentry gets Client, Staff and Account IDs, never personal details: request bodies, emails, phone numbers, addresses and Access Instructions are stripped, and session replay is off. Logs are JSON from `pino` to stdout, kept by the host, with a request ID on every line and every Sentry event, redacted the same way. No log vendor until searching the host's logs proves painful.

## Consequences

- Sentry's keys are required in production only, an exception to "the same variables in every mode": without them, development and tests send nothing.
- The static sites aren't uptime-checked: files on a CDN rarely fail on their own, and the one free uptime monitor is better spent on the API. Watching them, or a heartbeat per job, means paying for more monitors.
- One heartbeat says some job stopped, not which; the logs say which.
- Email can be missed at night: add phone push for urgent alerts before real Clients depend on the system. Urgency is already a tag, so that's routing, not code.
- The free plan has one user and a monthly error allowance, and a Metric Monitor can't group, so each new pool or measure is a monitor of its own.
