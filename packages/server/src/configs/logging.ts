import morgan from "morgan";
import env from "../env.ts";

const prodFormat = morgan((tokens, req, res) => {
  return JSON.stringify({
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: Number(tokens.status(req, res)),
    content_length: Number(tokens["res"](req, res, "content-length") || 0),
    response_time_ms: Number(tokens["response-time"](req, res)),
    remote_addr: tokens["remote-addr"](req, res),
    user_agent: tokens["user-agent"](req, res),
  });
});

const devFormat = morgan("dev");

export const networkLogger = env.APP_MODE === "dev" ? devFormat : prodFormat;
