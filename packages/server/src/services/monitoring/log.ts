import { pino, type DestinationStream, type Logger } from "pino";
import { scrub, scrubText } from "@empire-cleaning/models";
import { currentRequestId } from "#services/request";

// JSON to stdout (ADR-0007), kept by the host, scrubbed like Sentry events.
// LOG_LEVEL picks how much (tests silence it); `pretty` is for a person
// watching dev
export const createLogger = ({
  level = "info",
  pretty = false,
  destination,
}: {
  level?: string;
  pretty?: boolean;
  destination?: DestinationStream;
} = {}): Logger =>
  pino(
    {
      level,
      base: undefined,
      // the request's own logger (pino-http's) has it already
      mixin: (_fields, _level, logger) => {
        const requestId = currentRequestId();
        return requestId && !("requestId" in logger.bindings())
          ? { requestId }
          : {};
      },
      // pino scrubs before serializing: an Error becomes its scrubbed type,
      // message, stack and cause, so pino's own serializer mustn't touch it.
      // A request and response are left whole for theirs (middleware/
      // logging.ts), which keep only the method, scrubbed URL and status
      formatters: {
        log: ({ req, res, ...fields }) => ({
          ...(req ? { req } : {}),
          ...(res ? { res } : {}),
          ...scrub(fields),
        }),
        bindings: (fields) => scrub(fields),
      },
      serializers: { err: (error: unknown) => error },
      hooks: {
        logMethod(args, method) {
          method.apply(
            this,
            args.map((arg) =>
              typeof arg === "string" ? scrubText(arg) : arg,
            ) as Parameters<typeof method>,
          );
        },
      },
      ...(pretty && !destination
        ? { transport: { target: "pino-pretty" } }
        : {}),
    },
    destination,
  );

export const log = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  pretty: process.env.APP_MODE === "dev" && process.stdout.isTTY,
});
